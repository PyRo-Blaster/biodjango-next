# Iteration Plan: BioDjango v2.9.0

## Overview

This plan implements `docs/spec_v2.9.md`. v2.9 is infrastructure-only; it
ships after v2.8 has merged. The work is partitioned into five phases that
can be rolled out and verified independently.

## Phase Order and Dependencies

```
Phase 1 (Backend image multi-stage)
        │
        ▼
Phase 2 (Compose: shared image, healthchecks, env gates)
        │
        ▼
Phase 3 (Static files alignment)
Phase 4 (Frontend image: lockfile + npm ci)        (parallel with 3)
        │
        ▼
Phase 5 (.env.example + DEPLOY.md updates)
```

Phases 1 and 2 must land together because the compose file references the
named image produced by Phase 1. Phases 3 and 4 are independent.

---

## Phase 1: Backend Image Multi-Stage

### 1.1 Rewrite `backend/Dockerfile`

Replace the current single-stage file with a builder + runtime split.

```dockerfile
# syntax=docker/dockerfile:1.6

# ---------- builder ----------
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .
RUN pip wheel --wheel-dir=/wheels -r requirements.txt

# ---------- runtime ----------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        ncbi-blast+ \
        mafft \
        hmmer \
        libpq5 \
        netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

COPY entrypoint.sh /entrypoint.sh
COPY entrypoint-worker.sh /entrypoint-worker.sh
RUN chmod +x /entrypoint.sh /entrypoint-worker.sh

COPY . /app/

ENTRYPOINT ["/entrypoint.sh"]
```

Notes:

- Runtime keeps `libpq5` (driver-only) instead of `libpq-dev` (headers +
  driver). `psycopg2-binary` does not link against the dev headers at
  runtime.
- `ncbi-blast+`, `mafft`, `hmmer` stay in the runtime stage because the
  worker invokes them as binaries.
- `pip wheel` in the builder lets the runtime install be offline and
  fast.
- BuildKit syntax (`# syntax=docker/dockerfile:1.6`) enables better
  caching; Compose enables BuildKit automatically.

### 1.2 Split entrypoints

Keep the existing `backend/entrypoint.sh` as the **web** entrypoint:

```sh
#!/bin/sh
set -e

if [ "$SQL_ENGINE" = "django.db.backends.postgresql" ]; then
    echo "Waiting for postgres at $SQL_HOST:$SQL_PORT..."
    while ! nc -z "$SQL_HOST" "$SQL_PORT"; do sleep 0.5; done
    echo "PostgreSQL ready"
fi

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec "$@"
```

Add a new `backend/entrypoint-worker.sh`:

```sh
#!/bin/sh
set -e

if [ "$SQL_ENGINE" = "django.db.backends.postgresql" ]; then
    echo "Waiting for postgres at $SQL_HOST:$SQL_PORT..."
    while ! nc -z "$SQL_HOST" "$SQL_PORT"; do sleep 0.5; done
    echo "PostgreSQL ready"
fi

# No migrate, no collectstatic. The web service owns those.
exec "$@"
```

The worker compose service overrides `entrypoint:` to use this script.

### 1.3 `.dockerignore`

Add or extend `backend/.dockerignore` to keep the build context small:

```
__pycache__/
*.pyc
*.pyo
.venv/
.env
.env.*
db.sqlite3
staticfiles/
static/
media/
.pytest_cache/
.mypy_cache/
.git
```

### 1.4 Phase 1 deliverables

- `backend/Dockerfile` rewritten (multi-stage).
- `backend/entrypoint.sh` updated (idempotent migrate, set -e).
- `backend/entrypoint-worker.sh` added.
- `backend/.dockerignore` added/updated.

---

## Phase 2: Compose Topology

### 2.1 Build once, share by tag

Edit `docker-compose.prod.yml`. Backend services share an image tag; only
`web` carries a `build:` block.

```yaml
services:
  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=${POSTGRES_DB:-biodjango}
      - POSTGRES_USER=${POSTGRES_USER:-postgres}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-biodjango}"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  web:
    build:
      context: ./backend
    image: biodjango-backend:local
    command: >
      gunicorn config.wsgi:application
      --bind 0.0.0.0:8000
      --workers ${GUNICORN_WORKERS:-3}
      --timeout ${GUNICORN_TIMEOUT:-120}
      --access-logfile -
      --error-logfile -
    environment:
      - DEBUG=0
      - SECRET_KEY=${SECRET_KEY:?SECRET_KEY is required}
      - DJANGO_ALLOWED_HOSTS=${DJANGO_ALLOWED_HOSTS:?DJANGO_ALLOWED_HOSTS is required}
      - SQL_ENGINE=django.db.backends.postgresql
      - SQL_DATABASE=${POSTGRES_DB:-biodjango}
      - SQL_USER=${POSTGRES_USER:-postgres}
      - SQL_PASSWORD=${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      - SQL_HOST=db
      - SQL_PORT=5432
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/0
    volumes:
      - static_volume:/app/static
      - ${BLAST_DB_PATH:-./blastdb}:/data/blastdb
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health/')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  worker:
    image: biodjango-backend:local
    entrypoint: ["/entrypoint-worker.sh"]
    command: celery -A config worker -l info --concurrency=${CELERY_CONCURRENCY:-2}
    environment:
      - DEBUG=0
      - SECRET_KEY=${SECRET_KEY:?SECRET_KEY is required}
      - SQL_ENGINE=django.db.backends.postgresql
      - SQL_DATABASE=${POSTGRES_DB:-biodjango}
      - SQL_USER=${POSTGRES_USER:-postgres}
      - SQL_PASSWORD=${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      - SQL_HOST=db
      - SQL_PORT=5432
      - CELERY_BROKER_URL=redis://redis:6379/0
      - CELERY_RESULT_BACKEND=redis://redis:6379/0
    volumes:
      - ${BLAST_DB_PATH:-./blastdb}:/data/blastdb
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      web:
        condition: service_healthy

  nginx:
    build:
      context: .
      dockerfile: nginx.Dockerfile
    image: biodjango-nginx:local
    ports:
      - "80:80"
    volumes:
      - static_volume:/app/static:ro
    depends_on:
      web:
        condition: service_healthy

volumes:
  postgres_data:
  static_volume:
```

Key points:

- `worker` has no `build:` block. It relies on the `web` build to
  produce `biodjango-backend:local`. Compose will not build it twice.
- `worker` overrides `entrypoint:` to skip `migrate`/`collectstatic`.
- `worker.depends_on.web: service_healthy` enforces migration ordering:
  the worker only starts after `web` has come up healthy, which in
  turn only happens after `migrate` finished.
- Required env vars use `${VAR:?msg}` syntax, which makes Compose abort
  with a clear error if unset.
- The legacy `version: '3.8'` line is removed; recent Compose ignores
  it and warns.

### 2.2 Mirror in `docker-compose.yml` (dev)

Apply the same shared-image and split-entrypoint pattern to the dev
compose file. Dev keeps bind mounts under `./backend:/app`, runs
`runserver`, and tolerates `DEBUG=1`. The dev worker still uses
`entrypoint-worker.sh` so that even in dev, only `web` runs migrations.

### 2.3 Phase 2 deliverables

- `docker-compose.prod.yml` updated.
- `docker-compose.yml` updated.

---

## Phase 3: Static Files Alignment

### 3.1 Settings

Edit `backend/config/settings.py`:

```python
STATIC_URL = "/django_static/"
STATIC_ROOT = BASE_DIR / "static"
```

The directory name `static` matches the volume mount used by `web` and
`nginx`. The URL prefix `/django_static/` matches the alias already
declared in `nginx/nginx.conf:54-56`.

### 3.2 Nginx confirmation

`nginx/nginx.conf` already has:

```
location /django_static/ {
    alias /app/static/;
}
```

No change required, but verify the trailing slash and that
`static_volume` is mounted at `/app/static` in the nginx service (Phase
2 mounts it `:ro`).

### 3.3 Migration note

After deploy, Django admin URLs request `/django_static/admin/...` and
land on the volume populated by `collectstatic`. No data migration.

### 3.4 Phase 3 deliverables

- `backend/config/settings.py` two-line edit.

---

## Phase 4: Frontend Image — Lockfile and `npm ci`

### 4.1 Generate and commit the lockfile

In a clean checkout:

```
cd frontend
rm -rf node_modules
npm install
git add package-lock.json
```

Commit the lockfile alongside the Dockerfile change so the image build
has access to it.

### 4.2 Rewrite `frontend/Dockerfile`

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["npm", "run", "dev", "--", "--host"]
```

The `RUN rm -rf node_modules package-lock.json && npm install` line is
gone. The named volume `/app/node_modules` declared in
`docker-compose.yml` continues to shadow the host bind mount.

### 4.3 Update `nginx.Dockerfile`

```dockerfile
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 4.4 `.dockerignore` for frontend

Add `frontend/.dockerignore`:

```
node_modules
dist
.vite
.env
.env.*
```

### 4.5 Phase 4 deliverables

- `frontend/package-lock.json` committed.
- `frontend/Dockerfile` rewritten.
- `nginx.Dockerfile` updated to copy the lockfile and use `npm ci`.
- `frontend/.dockerignore` added.

---

## Phase 5: `.env.example` and `DEPLOY.md`

### 5.1 Add `.env.example` at repo root

```
# Django
SECRET_KEY=replace-me-with-a-real-secret
DEBUG=0
DJANGO_ALLOWED_HOSTS=localhost 127.0.0.1 [::1] web

# Database
POSTGRES_DB=biodjango
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace-me

# Celery
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# BLAST
BLAST_DB_PATH=./blastdb

# Gunicorn (optional)
GUNICORN_WORKERS=3
GUNICORN_TIMEOUT=120

# Celery (optional)
CELERY_CONCURRENCY=2
```

### 5.2 Update `DEPLOY.md`

- Replace the v2.6 references with v2.9 in the troubleshooting section.
- Add a "First-time deploy" subsection documenting the `${VAR:?}`
  failure mode: if `docker compose up` exits with `SECRET_KEY is
  required`, fill in `.env`.
- Note that `worker` no longer runs `migrate`; if a migration looks
  stuck, check `web` logs.
- Add the new env vars (`GUNICORN_WORKERS`, `GUNICORN_TIMEOUT`,
  `CELERY_CONCURRENCY`) to the reference table.

### 5.3 Phase 5 deliverables

- `.env.example` at repo root.
- `DEPLOY.md` updates.

---

## Verification

Run end-to-end against a clean machine:

```
git clean -xdf
cp .env.example .env
# Fill SECRET_KEY and POSTGRES_PASSWORD
time docker compose -f docker-compose.prod.yml build
docker images biodjango-backend:local
docker images biodjango-nginx:local
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
curl -fsS http://localhost/api/health/
curl -fsS http://localhost/django_static/admin/css/base.css | head -c 100
docker compose -f docker-compose.prod.yml logs web | grep -c "Applying"
docker compose -f docker-compose.prod.yml logs worker | grep -c "Applying"
```

Expectations:

- Backend image size strictly smaller than v2.7.
- Admin CSS responds 200.
- `web` log shows migration lines; `worker` log shows zero.
- Stopping the stack and `docker compose up` again completes in seconds
  (cached layers, healthchecks pass quickly).

Then test the failure mode:

```
unset SECRET_KEY
docker compose -f docker-compose.prod.yml up
```

Expect Compose to print `SECRET_KEY is required` and exit non-zero.

## Rollback Plan

Each phase is a small, isolated commit. Rollback is `git revert <sha>`
followed by `docker compose -f docker-compose.prod.yml up -d --build`.
The `static_volume` named volume can be removed if the static path
change confuses an existing deployment:

```
docker volume rm biodjango-next_static_volume
```

`collectstatic` repopulates it on the next `web` boot.

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Lockfile drift between dev and prod | Low | `npm ci` enforces parity; CI step `npm ci && npm run build` (future v2.10 work) |
| `psycopg2-binary` runtime breakage from removing `libpq-dev` | Medium | `libpq5` is sufficient for the binary wheel; verified by health check |
| `${VAR:?}` aborts surprise users | Low | `.env.example` ships with placeholders; `DEPLOY.md` explains |
| Existing `static_volume` has stale `/staticfiles` content | Low | One-time `docker volume rm` step; documented |
| BuildKit not enabled on older Compose | Low | `docker compose` v2 enables BuildKit by default; document minimum version |

## Out of Scope (Tracked for v2.10+)

- HTTPS / TLS termination via certbot or external reverse proxy.
- CI pipeline that lints `Dockerfile`s with `hadolint` and runs
  `npm ci && npm run build` on PRs.
- Image signing / SBOM generation.
- Move `psycopg2-binary` to `psycopg[binary]` v3.
- Switch to BuildKit cache mounts for `pip` and `apt` (`--mount=type=cache`).
- Refresh-token blacklist endpoint (carried over from v2.8 OOS list).
