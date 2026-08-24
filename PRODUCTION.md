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
   `["http://trusted-host:8088"]`.
5. Confirm the configured `LIBRARY_HTTP_PORT` is reachable only from the intended
   local/restricted network. This stack does not configure public exposure or TLS.

Do not reuse development secrets, database credentials, volumes, or cover paths.

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
For the first launch:

1. Keep the configured HTTP port restricted to the deployment host or a trusted
   administrator network.
2. Open `http://<server>:${LIBRARY_HTTP_PORT}` and immediately register the
   intended administrator.
3. Log in and verify that the account has administrator access.
4. Only then make the HTTP port generally reachable on the trusted LAN or connect
   it to the existing home reverse proxy.

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

docker compose -p library-prod --env-file .env.production -f compose.production.yml logs -f backend frontend
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
- Secrets: host file `.env.production`, ignored by Git
- Backup validation staging: backend container temporary storage; not a system backup

The source checkout is not runtime storage. PostgreSQL and FastAPI are not
published to the host; only the Nginx frontend port is published.
