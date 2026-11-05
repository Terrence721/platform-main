# Helpdesk deployment

The portable local stack is `docker compose --profile full up --build`. For a
public deployment, put a TLS-terminating reverse proxy or load balancer in
front of the app and keep the database and API off the host:

```shell
docker compose -f compose.yaml -f compose.production.yaml up --build -d
```

## Requirements

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

## Operational notes

- The database volume is `helpdesk-db`; back it up before upgrades.
- Reload nginx or the proxy after configuration or certificate changes.
- Monitor `/api/health` from the proxy.

```

```
