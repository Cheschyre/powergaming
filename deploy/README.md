# Deploying `powergaming-test`

One-time setup for step 6 of the roadmap. After this is done once, every
push to `develop` redeploys automatically via
`.github/workflows/cd-test.yml` -- nothing here needs repeating.

## How it fits together

```
push to develop
  -> CI builds backend + frontend images, pushes to GHCR
  -> GitHub Actions runner joins the tailnet (Tailscale OAuth client, tag:ci)
  -> SSHes into docker-host as the `deploy` user
  -> docker compose pull && up -d   (in /opt/powergaming-test)
```

The compose file itself (`docker-compose.test.yml`) lives in this repo
and is copied to the VM once, by hand, in step 2 below. The workflow
doesn't re-copy it on every deploy -- if you change it, re-copy it (step
2) by hand, or say so and this can be automated later (e.g. `scp` it
into the deploy step, or have the VM `git pull` a shallow clone).

## 1. Deploy user + SSH key (done)

A `deploy` user (in the `docker` group) already exists on `docker-host`
with the CI keypair's public half in its `authorized_keys`. Nothing to
redo here unless the key needs rotating.

## 2. Copy the stack to the VM

Run once, from a machine that can already SSH into `docker-host`
(replace the host below if it's not on the tailnet you're using):

```bash
ssh cheschyre@100.104.100.109 'sudo mkdir -p /opt/powergaming-test && sudo chown deploy:deploy /opt/powergaming-test'
scp docker-compose.test.yml cheschyre@100.104.100.109:/tmp/docker-compose.yml
ssh cheschyre@100.104.100.109 'sudo mv /tmp/docker-compose.yml /opt/powergaming-test/docker-compose.yml && sudo chown deploy:deploy /opt/powergaming-test/docker-compose.yml'
```

Then create the real `.env` (never committed -- see `.env.example` in
this folder for the fields):

```bash
ssh cheschyre@100.104.100.109 "sudo -u deploy tee /opt/powergaming-test/.env > /dev/null" <<'EOF'
POSTGRES_USER=powergaming
POSTGRES_PASSWORD=<pick a real password>
POSTGRES_DB=powergaming
TAG=develop
EOF
```

## 3. GitHub Actions secrets

Repo -> Settings -> Secrets and variables -> Actions -> New repository
secret:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | `100.104.100.109` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | the private half of the CI keypair (the file that was never committed -- ask if you need it regenerated) |
| `TS_OAUTH_CLIENT_ID` | from step 4 below |
| `TS_OAUTH_SECRET` | from step 4 below |

`GITHUB_TOKEN` (used to push to GHCR) is automatic -- no secret needed
for that one.

## 4. Tailscale OAuth client (for CI to join the tailnet)

In the Tailscale admin console (Settings -> OAuth clients):

1. Create a new OAuth client, scoped to **Devices: Write**.
2. Give it the tag `tag:ci` (create that tag first under Access
   controls if it doesn't exist yet).
3. Copy the generated client ID and secret into the
   `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET` GitHub secrets above.

Then in your ACL policy (Access controls), make sure `tag:ci` is
allowed to reach `docker-host` on port 22 -- the default "everyone can
reach everyone" ACL already covers this; only relevant if you've
tightened it since.

Each CI run joins the tailnet as a throwaway ephemeral node tagged
`tag:ci`, SSHes in, and disconnects when the job ends -- it doesn't
leave a permanent device behind.

## 5. Make the GHCR images pullable

The first time `build-backend`/`build-frontend` push, GHCR creates the
packages as **private** by default, and the `deploy` user has no GHCR
credentials to pull a private image. After the first CI run:

1. Go to the repo's GitHub page -> Packages (right sidebar) -> open
   `powergaming-backend`, then `powergaming-frontend`.
2. Package settings -> Change visibility -> **Public**.

(Alternative if you'd rather keep them private: `docker login ghcr.io`
on the VM with a PAT that has `read:packages`. Public is simpler for a
home-lab test stack.)

## Verifying it worked

```bash
ssh cheschyre@100.104.100.109 'cd /opt/powergaming-test && docker compose ps'
curl http://100.104.100.109:8081/          # frontend
curl http://100.104.100.109:8001/health    # backend
```
