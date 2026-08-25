# Production deployment

Production is deliberately separate from the development stack. Always include both
`-p library-prod` and `-f compose.production.yml` in production commands. Never
run the production file with the development project name or omit the production
file selector.

## Before the first launch

1. Create a dedicated production checkout.
2. Copy the template and create production-only values:

   ```bash
   cp .env.production.example .env.production
   chmod 600 .env.production
   ```

3. Replace every `change-me` value. Keep the database values and the credentials
   embedded in `DATABASE_URL` consistent. URL-encode reserved characters in the
   URL. Its host must remain `db`.
4. Keep `CORS_ORIGINS=[]` for the normal same-origin deployment. If another
   trusted browser origin is required, use a JSON list such as
   `["https://library.home:8443"]`.
5. Set `LIBRARY_HOSTNAME` to the local hostname clients will use (the default is
   `library.home`). Configure local DNS so that hostname resolves to the OMV
   server LAN address. Do not expose this internal-CA deployment directly to
   the public internet.

Do not reuse development secrets, database credentials, volumes, or cover paths.

## HTTPS architecture and client trust

Production traffic follows this path:

```text
Browser -> HTTPS :8443 -> Caddy :8443 -> frontend:80 (Nginx)
                                |-> /api -> backend:8000
                                `-> /covers -> backend:8000
```

The Library App Caddy publishes only host TCP port 8443 (`8443:8443`). It does
not publish ports 80 or 443 because another Caddy instance on the OMV server owns
port 443. The frontend remains reachable to Caddy as `frontend:80` on
`library_prod_network`, but it no longer publishes a host HTTP port. PostgreSQL
and FastAPI also remain internal.

Open the application at `https://library.home:8443`, replacing `library.home` with
the configured `LIBRARY_HOSTNAME`. Every client must resolve that hostname to
the OMV server, normally through the LAN DNS server or a client hosts-file entry.

The production Caddyfile uses `tls internal`, so Caddy issues the site certificate
from its own internal CA and does not use Let's Encrypt or public ACME. Client devices must trust
this Library App Caddy instance's root CA or browsers will show a certificate warning.
After Caddy has started once and generated the CA, export its root certificate:

```bash
docker compose \
  -p library-prod \
  --env-file .env.production \
  -f compose.production.yml \
  cp caddy:/data/caddy/pki/authorities/local/root.crt ./library-prod-caddy-root.crt
```

The certificate is stored persistently in the `library_prod_caddy_data` volume
at `caddy/pki/authorities/local/root.crt`. Copy the exported certificate to each
client through a trusted channel and install it as a trusted root certificate
using the client's certificate-management procedure. Keep the CA private key in
the Caddy data volume private; distribute only `root.crt`.

## Build and first launch

These commands build images and start the production database, run the one-shot
Alembic migration, then start the backend and frontend only after their
dependencies succeed:

```bash
git pull

docker compose \
  -p library-prod \
  --env-file .env.production \
  -f compose.production.yml \
  build

docker compose \
  -p library-prod \
  --env-file .env.production \
  -f compose.production.yml \
  up -d
```

Alembic runs `upgrade head` on every deployment. An already-current database is
left unchanged. If migration fails, the backend does not start.

## First administrator bootstrap

The first account registered in an empty database becomes the administrator.
For the first launch, first ensure the administrator device trusts the Caddy root
CA, then:

1. Keep port 8443 restricted to the trusted LAN.
2. Open `https://${LIBRARY_HOSTNAME}:8443` and immediately register the intended
   administrator (substitute the configured hostname if needed).
3. Log in and verify that the account has administrator access.
4. Only then make the HTTPS service generally reachable on the trusted LAN.

Later registrations remain inactive until approved by an administrator.

## Normal updates

Back up production first, then:

```bash
git pull

docker compose \
  -p library-prod \
  --env-file .env.production \
  -f compose.production.yml \
  build

docker compose \
  -p library-prod \
  --env-file .env.production \
  -f compose.production.yml \
  up -d
```

## Status and logs

```bash
docker compose -p library-prod --env-file .env.production -f compose.production.yml ps

docker compose -p library-prod --env-file .env.production -f compose.production.yml logs --tail=200

docker compose -p library-prod --env-file .env.production -f compose.production.yml logs -f backend frontend caddy
```

The completed `migration` service normally appears as exited with status 0.

## Stop production

This stops production containers but preserves production volumes:

```bash
docker compose \
  -p library-prod \
  --env-file .env.production \
  -f compose.production.yml \
  down
```

Never add `--volumes` unless intentionally destroying production data.

## Backups

Create a restricted directory:

```bash
mkdir -p backups
chmod 700 backups
```

Create a PostgreSQL custom-format dump:

```bash
docker compose \
  -p library-prod \
  --env-file .env.production \
  -f compose.production.yml \
  exec -T db \
  sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > backups/library-prod.dump
```

Archive the complete covers volume. This may pull the small Alpine image if it is
not already present:

```bash
docker run --rm \
  -v library_prod_covers:/data:ro \
  -v "$PWD/backups:/backup" \
  alpine:3.20 \
  tar -czf /backup/library-prod-covers.tar.gz -C /data .
```

Store the database dump, covers archive, and a secure recovery copy of production
secrets together. The database and covers are one logical backup set.

## Restore

A restore replaces production data. Keep the old volumes or take another backup
before proceeding. Stop application writers while restoring:

```bash
docker compose -p library-prod --env-file .env.production -f compose.production.yml stop frontend backend
```

Restore the database dump:

```bash
docker compose \
  -p library-prod \
  --env-file .env.production \
  -f compose.production.yml \
  exec -T db \
  sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  < backups/library-prod.dump
```

Restore covers only from the matching backup set. The command below replaces the
contents of the production covers volume:

```bash
docker run --rm \
  -v library_prod_covers:/data \
  -v "$PWD/backups:/backup:ro" \
  alpine:3.20 \
  sh -c 'find /data -mindepth 1 -delete && tar -xzf /backup/library-prod-covers.tar.gz -C /data'
```

Then apply any newer repository migrations and restart services:

```bash
docker compose -p library-prod --env-file .env.production -f compose.production.yml run --rm migration

docker compose -p library-prod --env-file .env.production -f compose.production.yml up -d
```

Verify login, a book cover, metadata search, and `/health` after restoration.

## Persistent resources

- PostgreSQL: Docker volume `library_prod_postgres_data`
- Local/downloaded/restored covers: Docker volume `library_prod_covers`
- Caddy certificates and internal CA: Docker volume `library_prod_caddy_data`
- Caddy runtime configuration: Docker volume `library_prod_caddy_config`
- Secrets: host file `.env.production`, ignored by Git
- Backup validation staging: backend container temporary storage; not a system backup

The source checkout is not runtime storage. PostgreSQL and FastAPI are not
published to the host. The Nginx frontend is also no longer published directly;
only the Library App Caddy publishes host port 8443; it does not publish ports 80
or 443.

## Updating an existing OMV Compose stack

Back up production first, then update the live stack as follows:

1. Pull the updated `production-deployment` branch in the production checkout.
2. Add `LIBRARY_HOSTNAME=library.home` (or the chosen local hostname) to the live
   `.env.production` and remove `LIBRARY_HTTP_PORT`.
3. Configure local DNS so the chosen hostname resolves to the OMV server.
4. In the OMV Compose UI, refresh the compose definition and environment, then
   redeploy it. From a shell, use the `build` and `up -d` commands in **Normal
   updates** above.
5. Export the generated `root.crt` with the command in **HTTPS architecture and
   client trust**, install it on each client, and open
   `https://library.home:8443` (substituting the configured hostname if needed).
6. Verify login, API operations, cover images, metadata search, and SPA routes.

The repository deliberately keeps portable relative build contexts (`./backend`
and `./frontend`). If a particular OMV Web UI version requires absolute build
contexts, adapt those paths only in the OMV deployment definition to point at the
production checkout; do not commit the server's absolute filesystem path to this
repository.
