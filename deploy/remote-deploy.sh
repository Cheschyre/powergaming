#!/usr/bin/env bash
# Runs ON docker-host, as the deploy user, from the CD workflow
# (.github/workflows/deploy-stack.yml), which uploads the new compose file
# as docker-compose.yml.new plus this script, then runs it:
#
#   bash /opt/powergaming-<stack>/remote-deploy.sh /opt/powergaming-<stack> <image-tag>
#
# Always run it as a file -- never pipe it into `bash -s`: docker compose
# exec/run read stdin and would swallow the rest of the script.
#
# Order matters -- nothing live changes until the new release has been
# validated, the database backed up, and its migrations applied:
#
#   1. Write the new image tag into a copy of .env; validate it together
#      with the uploaded compose file.
#   2. Pull the new images.
#   3. Make sure Postgres is up and healthy.
#   4. pg_dump the database to backups/ (newest $KEEP_BACKUPS kept).
#   5. Run `alembic upgrade head` once, in a throwaway container from the
#      NEW api image.
#   6. Swap in the new compose file and .env, then recreate the stack.
#
# Steps 2-5 use the new files explicitly, so if any of them fails, the
# live docker-compose.yml/.env and the running containers are untouched.
set -euo pipefail

stack_dir=$1
image_tag=$2
KEEP_BACKUPS=${KEEP_BACKUPS:-10}

cd "$stack_dir"
trap 'rm -f docker-compose.yml.new .env.new backups/*.partial' EXIT

if [ ! -f .env ]; then
  echo "no .env in $stack_dir -- see deploy/README.md" >&2
  exit 1
fi

# 1. New .env = old one with TAG replaced; validate with the new compose file.
(umask 077; { grep -v '^TAG=' .env || true; echo "TAG=$image_tag"; } > .env.new)
new=(docker compose --env-file .env.new -f docker-compose.yml.new)
"${new[@]}" config -q

# 2-3. Pull, and make sure the database is running and healthy.
"${new[@]}" pull
"${new[@]}" up -d --wait db

# 4. Pre-migration backup. Written to a temp name first so a failed dump
# never looks like a good one.
mkdir -p -m 700 backups
backup="backups/$(date -u +%Y%m%dT%H%M%SZ)-pre-$image_tag.sql.gz"
# Single quotes on purpose: $POSTGRES_* expand inside the db container.
# shellcheck disable=SC2016
(
  umask 077
  "${new[@]}" exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
    | gzip > "$backup.partial"
)
mv "$backup.partial" "$backup"
echo "Backed up database to $stack_dir/$backup ($(du -h "$backup" | cut -f1))"
# Keep only the newest $KEEP_BACKUPS (names sort by timestamp).
find backups -maxdepth 1 -name '*.sql.gz' | sort | head -n -"$KEEP_BACKUPS" | xargs -r rm --

# 5. Migrate with the new code, once, before the new api starts.
"${new[@]}" run --rm --no-deps -T api alembic upgrade head

# 6. Go live.
mv .env.new .env
mv docker-compose.yml.new docker-compose.yml
docker compose up -d --remove-orphans
docker image prune -f
echo "Deployed $image_tag to $stack_dir"
