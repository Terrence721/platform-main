# Helpdesk deployment

The portable local stack is `docker compose --profile full up --build`. For a
public deployment, put a TLS-terminating reverse proxy or load balancer in
front of the app and keep the database and API off the host:

```shell
docker compose -f compose.yaml -f compose.production.yaml up --build -d
```

## Requirements

- Set `NODE_ENV=production`; cookie `Secure` and several production-only
  checks depend on it.
- Set `HELPDESK_DB_PASSWORD`, `HELPDESK_DB_USER`, `HELPDESK_DB_NAME` and
  `HELPDESK_JWT_SECRET` before starting; they have no development defaults
  in this override.
- `HELPDESK_JWT_SECRET` must be at least 32 characters and not the
  published development secret.
- Provision a TLS certificate and terminate HTTPS at the proxy.
- Add security headers, including a strict `Content-Security-Policy`.
- Restrict rate limiting and brute-force handling at the edge.
- Store `HELPDESK_DB_PASSWORD` and `HELPDESK_JWT_SECRET` in a secret
  manager rather than a committed file.
- Take database backups and test restores.
- Run migrations as a controlled deployment step, not under concurrent
  scaling.
- Keep ClamAV behind the proxy/network; it is not publicly exposed.

## Database operations

Back up the database before deploys and upgrades:

```shell
pg_dump -Fc --no-owner --no-privileges \
  "$DATABASE_URL" \
  -f "helpdesk-$(date +%Y%m%dT%H%M%S).dump"
```

Restore test the backup in staging before relying on it:

```shell
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "$DATABASE_URL" helpdesk-*.dump
```

Within Docker Compose, run the same commands against the `db` service:

```shell
docker compose exec -T db pg_dump -Fc --no-owner --no-privileges \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" > helpdesk.dump
```

Migration workflow:

1. Change the Drizzle schema.
2. Run `yarn db:generate`, which compares the schema with the last snapshot.
3. Commit the generated migration and snapshot.
4. CI checks that the source tree is unchanged after generation.
5. Deploy code and migration together.

Rollback:

1. Deploy the previous application image.
2. Restore the pre-deployment database backup.
3. Confirm `/api/health` and a sign-in.

## Secret management

Production should inject secrets at runtime rather than from `.env`:

- Store `HELPDESK_DB_PASSWORD`, `HELPDESK_SEED_PASSWORD`, and
  `HELPDESK_JWT_SECRET` in a secret manager.
- Mount or inject them into the API container as environment variables.
- Rotate `HELPDESK_JWT_SECRET` deliberately; rotation signs everyone out.
- Keep `HELPDESK_SEED_PASSWORD` out of the image and CI logs.

Example Compose convention:

```shell
docker compose -f compose.yaml -f compose.production.yaml up -d
```

In Kubernetes, use a Secret or external secret provider and mount it as
environment variables.

## Observability and SLOs

- Nginx emits JSON access logs with request time, status, upstream, and
  body bytes.
- API health is `/api/health`; monitor it from the proxy and alert on
  repeated failures.
- Suggested service-level objectives:
  - 99.9% availability for `/api/health`
  - 99% of sign-in and ticket operations under 1 second
  - zero unhandled API exceptions in production
- Export or retain the nginx and API logs in a central system for at
  least 30 days.
- Add metrics and tracing for the NestJS API before high-scale use.

## Scaling notes

- The API is currently a single-instance service: `SignInLimits` keeps
  its sign-in counts in process memory.
- Run exactly one API instance, or replace `SignInLimits` with a shared
  backend such as Redis before scaling out.
- Sticky sessions are not sufficient: counters and buckets must be
  shared rather than per-process.

## Edge and ClamAV notes

- Put nginx behind a WAF or load balancer and rate-limit the public routes
  and file uploads there.
- Keep the ClamAV profile on only where uploads are scanned; give it at
  least 1 GB of memory and the 5-minute startup period in compose.yaml.
- Confirm ClamAV health before a deploy that relies on scanning.
- Tune upload-size and part limits together with the API's multer config.

## Operational notes

- The database volume is `helpdesk-db`; back it up before upgrades.
- Reload nginx or the proxy after configuration or certificate changes.
- Monitor `/api/health` from the proxy.

```

```
