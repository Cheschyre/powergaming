# Deploying `powergaming-test` and `powergaming-prod`

Both stacks run on the home-lab `docker-host` VM (Tailscale IP
`100.104.100.109`) from the same compose file, as separate compose
projects -- separate containers, network and Postgres volume:

| | powergaming-test | powergaming-prod |
|---|---|---|
| Deploys on | every push to `develop` | a version tag (`v1.2.3`) on `main` |
| Workflow | `.github/workflows/cd-test.yml` | `.github/workflows/cd-prod.yml` |
| Image tag | `:develop` | `:v1.2.3` |
| VM directory | `/opt/powergaming-test` | `/opt/powergaming-prod` |
| Frontend / API | `:8081` / `:8001` | `:8082` / `:8002` |
| GitHub Environment | `test` | `production` |

Both workflows call `.github/workflows/deploy-stack.yml`, which does the
actual work:

```
build backend + frontend images, push to GHCR (:<tag> and :<commit sha>)
  -> runner joins the tailnet (Tailscale OAuth client, tag:ci)
  -> checks docker-host answers `tailscale ping`
  -> checks docker-host's SSH host key against the pinned fingerprint
  -> scp's deploy/docker-compose.yml to /opt/powergaming-<stack>
  -> uploads deploy/remote-deploy.sh and runs it on the VM:
       validate the new compose file + .env (with TAG=<tag>)
       pull the new images
       pg_dump the database to backups/          (newest 10 kept)
       alembic upgrade head, once, from the new api image
       only then swap in the new files and docker compose up -d
```

If anything before the final step fails -- bad compose file, failed
pull, failed backup, failed migration -- the live compose file, `.env`
and running containers are left exactly as they were.

The compose file lives only in this repo -- edit it here and push, never
on the VM, since the next deploy overwrites it. The only VM-side file is
each stack's `.env` (credentials, ports, `APP_ENV`); `TAG` in it is
rewritten by every deploy.

If the VM is ever rebuilt, deploys fail with "docker-host host key is
..., expected ..." -- update `HOST_KEY_FINGERPRINT` in
`deploy-stack.yml` from `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`.

## Releasing to prod

```bash
# 1. Get the release onto main (normally: merge a develop -> main PR)
# 2. Tag it on main and push the tag
git checkout main && git pull
git tag v1.0.0
git push origin v1.0.0
```

`cd-prod.yml` refuses tags that aren't on `main`. If the `production`
Environment has required reviewers (step 6), the deploy job waits for
your approval in the Actions tab before touching prod.

**Rolling back:** open the older tag's "CD - prod" run in the Actions tab
and click **Re-run all jobs** -- it rebuilds that tag and redeploys it.
If a release in between changed the database schema, restore the backup
from before it first (see below) -- otherwise the rollback deploy stops
with `Can't locate revision ...`, leaving the current version running.

## Database: migrations and backups

Migrations run **once per deploy**, not on container start: the api
container only runs `uvicorn`, and `remote-deploy.sh` runs
`alembic upgrade head` in a one-off container from the new image, right
after backing up. Restarting a container never changes the schema.
Postgres runs each migration in a transaction, so one that fails
partway leaves the schema as it was (and the deploy stops, old version
still serving).

Every deploy first writes a backup to
`/opt/powergaming-<stack>/backups/<UTC time>-pre-<tag>.sql.gz` (mode 600,
newest 10 kept per stack). To list them:

```bash
sudo ls -l /opt/powergaming-prod/backups
```

**Restoring a backup** (e.g. to roll back past a schema change). This
replaces the stack's whole database with the backup's contents:

```bash
cd /opt/powergaming-prod                           # or /opt/powergaming-test
B=backups/<file>.sql.gz                           # the backup to restore
sudo -u deploy docker compose stop api
sudo cat "$B" | gunzip | sudo -u deploy docker compose exec -T db sh -c \
  'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" &&
   createdb -U "$POSTGRES_USER" "$POSTGRES_DB" &&
   psql -q -o /dev/null -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
```

Then redeploy the version that matches the backup (its `pre-<tag>` is
the version that was running when it was taken): re-run that tag's
"CD - prod" run, or for test, push to `develop`. The api stays stopped
until that deploy starts it.

**Manual backup** at any other time:

```bash
cd /opt/powergaming-prod
sudo -u deploy docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | gzip > ~/powergaming-prod-$(date +%F).sql.gz
```

## One-time setup

Steps 1-5 were done for step 6 (test) and are shared by prod. Step 6
below is prod-only.

### 1. Deploy user + SSH key (done)

A `deploy` user (in the `docker` group) exists on `docker-host` with the
CI key's public half in `~deploy/.ssh/authorized_keys`. To rotate it,
generate a new keypair, replace that file's contents with the new
public key, and update the `DEPLOY_SSH_KEY` secret with the private key.

### 2. Test stack directory (done)

```bash
sudo mkdir -p /opt/powergaming-test && sudo chown deploy:deploy /opt/powergaming-test
sudo -u deploy tee /opt/powergaming-test/.env > /dev/null <<'EOF'
POSTGRES_USER=powergaming
POSTGRES_PASSWORD=<pick a real password>
POSTGRES_DB=powergaming
WEB_PORT=8081
API_PORT=8001
APP_ENV=test
EOF
sudo chmod 600 /opt/powergaming-test/.env
```

### 3. GitHub Actions secrets (done)

Repo -> Settings -> Secrets and variables -> Actions:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | `100.104.100.109` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | the CI private key |
| `TS_OAUTH_CLIENT_ID` | from step 4 |
| `TS_OAUTH_SECRET` | from step 4 (starts `tskey-client-`) |

`GITHUB_TOKEN` (used to push to GHCR) is automatic.

### 4. Tailscale OAuth client (done)

1. Access controls -> Definitions -> **Create tag** `tag:ci`, owner
   `autogroup:admin`.
2. Settings -> **Trust credentials** -> **+ Credential** -> OAuth, with
   **Write** on **Keys -> Auth Keys** and **Devices -> Core**, both
   tagged `tag:ci`.
3. Copy the client ID and secret into the two `TS_OAUTH_*` secrets.

Each CI run joins as an ephemeral `tag:ci` node and disappears when the
job ends. If you tighten the default allow-all policy, keep `tag:ci`
allowed to reach `docker-host` on port 22.

### 5. GHCR packages public (done)

`powergaming-backend` and `powergaming-frontend` are public so the VM
can pull without credentials (github.com/Cheschyre?tab=packages ->
package -> Package settings -> Change visibility).

### 6. Prod stack directory + approval gate

On `docker-host` -- use a **different** password from test:

```bash
sudo mkdir -p /opt/powergaming-prod && sudo chown deploy:deploy /opt/powergaming-prod
sudo -u deploy tee /opt/powergaming-prod/.env > /dev/null <<'EOF'
POSTGRES_USER=powergaming
POSTGRES_PASSWORD=<pick a different real password>
POSTGRES_DB=powergaming
WEB_PORT=8082
API_PORT=8002
APP_ENV=prod
EOF
sudo chmod 600 /opt/powergaming-prod/.env
sudo ss -ltn '( sport = :8082 or sport = :8002 )'   # should print only the header
```

Optional but recommended -- make prod deploys wait for your approval:
repo -> Settings -> **Environments** -> `production` (it appears after
the first prod run; or create it with **New environment**) -> **Required
reviewers** -> add yourself. (Required reviewers need a public repo or a
paid GitHub plan.)

## Verifying a deploy

```bash
# .env is mode 600 (it holds the DB password), so run compose as deploy
cd /opt/powergaming-test && sudo -u deploy docker compose ps   # or /opt/powergaming-prod
curl -s http://100.104.100.109:8081/api/builds    # test (prod: 8082)
curl -s http://100.104.100.109:8001/health        # test (prod: 8002)
```
