# BioDjango v2.9 Production Deployment Guide

## Overview

This guide covers production deployment with Docker Compose after the v2.9
deployment hardening work:

- backend image is built once and shared by `web` and `worker`
- only `web` runs `migrate` and `collectstatic`
- Django static assets are served from `/django_static/`
- frontend and nginx builds use `npm ci` and the committed lockfile
- required environment variables fail fast during `docker compose up`

For external beta rollout guidance, see `docs/beta_test_guide_v2.7.md`.

This guide also includes a release handoff checklist for publishing `v2.9` to
GitHub.

---

## Prerequisites

- Linux server with Docker Engine and Docker Compose v2+
- Access to a BLAST database path if analysis features are needed
- A writable directory for `.env`

---

## First-Time Deploy

### Step 1: Clone and create `.env`

```bash
git clone <repository-url>
cd biodjango-next
cp .env.example .env
```

### Step 2: Edit required values

At minimum, set the following:

```bash
SECRET_KEY=replace-with-a-real-secret
POSTGRES_PASSWORD=replace-with-a-real-password
DJANGO_ALLOWED_HOSTS=localhost 127.0.0.1 [::1] web your-server-ip
```

Optional tuning:

```bash
BLAST_DB_PATH=/mnt/data/blastdb
GUNICORN_WORKERS=3
GUNICORN_TIMEOUT=120
CELERY_CONCURRENCY=2
```

### Step 3: Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Step 4: Verify

```bash
docker compose -f docker-compose.prod.yml ps
curl -fsS http://localhost/api/health/
curl -fsS http://localhost/django_static/admin/css/base.css | head -c 100
```

Expected results:

- `web`, `worker`, `db`, `redis`, and `nginx` are `Up`
- `/api/health/` returns `{"status": "ok"}`
- admin CSS is served successfully from `/django_static/`

### Step 5: Smoke test core features

After login in browser:

- `Projects`: list and create project
- `Peptide Calculator`: run calculation and download CSV

If unauthenticated access to protected pages occurs, the frontend should
redirect to `/login` before protected API calls.

---

## Fail-Fast Behavior

Production compose now requires some variables explicitly. If you see an error
like this:

```bash
SECRET_KEY is required
```

or:

```bash
POSTGRES_PASSWORD is required
```

then `docker compose` is working as intended. Fill the missing value in `.env`
and run the command again.

---

## Service Responsibilities

- `web`: runs migrations, collects static files, serves Django through Gunicorn
- `worker`: starts Celery only, does not run migrations
- `nginx`: serves the built frontend and proxies `/api/`, `/admin/`, and `/django_static/`

If a migration appears stuck, check `web` logs first. The `worker` container no
longer owns any migration work.

---

## Build Context Hygiene (Exclude Test Files)

For production image builds, test files are excluded via `.dockerignore`:

- backend excludes `tests/`, `tests.py`, and `test_*.py`
- frontend excludes `__tests__/`, `*.test.*`, and `*.spec.*`

This keeps deployment images smaller and reduces noisy context transfer in CI.

---

## Common Issues

### Django returns `400 Bad Request`

Update `.env` so `DJANGO_ALLOWED_HOSTS` contains your server IP or domain:

```bash
DJANGO_ALLOWED_HOSTS=localhost 127.0.0.1 [::1] web your-server-ip
```

### Admin CSS returns `404`

The stack now serves admin static assets from `/django_static/`. If you upgraded
from an older deployment and still see stale static content, recreate the named
volume and bring the stack up again:

```bash
docker compose -f docker-compose.prod.yml down
docker volume rm biodjango-next_static_volume
docker compose -f docker-compose.prod.yml up -d --build
```

### Database connection fails during boot

`web` and `worker` both wait for Postgres, and Compose also uses health checks.
If boot still fails, inspect `db` first:

```bash
docker compose -f docker-compose.prod.yml logs db
docker compose -f docker-compose.prod.yml logs web
```

### Large file uploads fail

Nginx keeps `client_max_body_size 100M`. If you need larger uploads, update
`nginx/nginx.conf` and redeploy.

---

## Managing The Application

### View logs

```bash
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs -f nginx
```

### Restart

```bash
docker compose -f docker-compose.prod.yml restart
```

### Stop

```bash
docker compose -f docker-compose.prod.yml down
```

### Update and redeploy

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Publish GitHub release (v2.9)

```bash
git status
git add README.md DEPLOY.md backend/.dockerignore frontend/.dockerignore
git commit -m "docs(release): prepare v2.9 deployment and release notes"
git tag -a v2.9.0 -m "v2.9.0"
git push origin main
git push origin v2.9.0
```

Then create a GitHub Release from tag `v2.9.0`, and include:

- beta verification result (`health`, auth, projects, peptide calculator)
- deployment notes from this document
- any known non-blocking warnings (for example short `SECRET_KEY`)

### Run migrations manually

```bash
docker compose -f docker-compose.prod.yml exec web python manage.py migrate
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | none | Django secret key |
| `DEBUG` | No | `0` | Debug mode |
| `DJANGO_ALLOWED_HOSTS` | Yes | none | Allowed hosts for Django |
| `POSTGRES_DB` | No | `biodjango` | Database name |
| `POSTGRES_USER` | No | `postgres` | Database user |
| `POSTGRES_PASSWORD` | Yes | none | Database password |
| `BLAST_DB_PATH` | No | `./blastdb` | BLAST database mount path |
| `CELERY_BROKER_URL` | No | `redis://redis:6379/0` | Celery broker URL |
| `CELERY_RESULT_BACKEND` | No | `redis://redis:6379/0` | Celery result backend |
| `GUNICORN_WORKERS` | No | `3` | Gunicorn worker count |
| `GUNICORN_TIMEOUT` | No | `120` | Gunicorn timeout in seconds |
| `CELERY_CONCURRENCY` | No | `2` | Celery worker concurrency |

---

## Troubleshooting Commands

```bash
docker inspect --format='{{.State.Health.Status}}' biodjango-next-web-1
docker exec -it biodjango-next-web-1 sh
docker logs biodjango-next-nginx-1
docker compose -f docker-compose.prod.yml config
```

---

## Security Notes

1. Set a strong `SECRET_KEY`
2. Set a strong `POSTGRES_PASSWORD`
3. Keep `DEBUG=0` in production
4. Put TLS termination in front of nginx if the server is Internet-facing
5. Keep Docker images and npm/python dependencies up to date
