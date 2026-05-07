# Spec: BioDjango v2.9.0 — Deployment and Image Build Optimization

## Overview

v2.9 addresses operational issues with the Docker Compose deployment that
surfaced during the v2.7 rollout. The two recurring complaints from the
deploy team are (a) cold builds take much longer than they should and
(b) the production stack has subtle correctness bugs that only manifest
after a successful build (Django admin static files 404, migrations race
between `web` and `worker`, etc.).

This iteration is infrastructure-only. Application code is unchanged
except for entrypoint scripts and a settings constant. v2.8 application
work (permissions, frontend request layer) must be merged before v2.9.

## Goals

- Cold `docker compose -f docker-compose.prod.yml build` finishes
  noticeably faster on a clean machine, and incremental rebuilds after
  a Python/TS edit complete in seconds.
- The backend image is built **once** per pipeline run and shared by
  `web` and `worker`.
- Production runtime image does not carry `build-essential`/`gcc`.
- Frontend builds use a committed lockfile via `npm ci`; no runtime
  `npm install` and no `rm -rf node_modules` in the Dockerfile.
- Django admin static files render correctly behind nginx.
- Database migrations run exactly once at cold start, from `web` only.
- Production compose fails fast when `SECRET_KEY` or
  `POSTGRES_PASSWORD` is unset, instead of booting with a default.
- Repository ships a working `.env.example` matching `DEPLOY.md`.

## Non-Goals

- No Kubernetes / Helm work.
- No HTTPS / certbot / reverse proxy changes (still optional, still
  documented as user-side).
- No change to Postgres or Redis major versions.
- No change to the gunicorn or celery process model beyond worker
  count and timeouts.
- No CI pipeline changes (GitHub Actions, etc.) in this iteration.

## Target Build Topology

```
                       backend/Dockerfile (multi-stage)
                       ┌─────────────────────────────────┐
                       │ Stage: builder                  │
                       │  - python:3.11-slim             │
                       │  - apt: build-essential, gcc,   │
                       │         libpq-dev, ...          │
                       │  - pip wheel -r requirements.txt│
                       └────────────────┬────────────────┘
                                        │ /wheels
                                        ▼
                       ┌─────────────────────────────────┐
                       │ Stage: runtime                  │
                       │  - python:3.11-slim             │
                       │  - apt: ncbi-blast+, mafft,     │
                       │         hmmer, libpq5,          │
                       │         netcat-openbsd          │
                       │  - pip install --no-index       │
                       │       --find-links=/wheels      │
                       │  - COPY backend source          │
                       └─────────────────────────────────┘
                                        │
                              biodjango-backend:local
                                        │
                       ┌────────────────┴────────────────┐
                       ▼                                 ▼
                  service: web                      service: worker
              (gunicorn, runs migrate)           (celery, no migrate)
```

```
              nginx.Dockerfile (multi-stage, unchanged shape)
              ┌──────────────────────────────────────────┐
              │ Stage: frontend-builder                  │
              │  - node:22-alpine                        │
              │  - COPY package.json package-lock.json   │
              │  - npm ci                                │
              │  - COPY src ; npm run build              │
              └────────────────────┬─────────────────────┘
                                   │ /app/dist
                                   ▼
              ┌──────────────────────────────────────────┐
              │ Stage: nginx                             │
              │  - nginx:alpine                          │
              │  - COPY dist  /usr/share/nginx/html      │
              │  - COPY nginx.conf                       │
              └──────────────────────────────────────────┘
```

## Configuration Contracts

### Static files

- `STATIC_URL = "/django_static/"` (matches the existing nginx alias).
- `STATIC_ROOT = BASE_DIR / "static"` (matches the `static_volume` mount).
- `entrypoint.sh` runs `collectstatic --noinput` only in the `web`
  service.

### Migrations

- Only `web` runs `python manage.py migrate` at startup.
- `worker` uses an entrypoint that **does not** call `migrate` and waits
  for Postgres before launching celery.

### Environment

`docker-compose.prod.yml` declares required variables without defaults
so an unset env aborts the boot:

```yaml
environment:
  - SECRET_KEY=${SECRET_KEY:?SECRET_KEY is required}
  - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
  - DJANGO_ALLOWED_HOSTS=${DJANGO_ALLOWED_HOSTS:?DJANGO_ALLOWED_HOSTS is required}
```

`DEBUG`, `BLAST_DB_PATH`, `POSTGRES_DB`, `POSTGRES_USER` keep their
existing defaults.

### Database health

`db` service exposes a healthcheck:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-biodjango}"]
  interval: 5s
  timeout: 3s
  retries: 10
```

`web` and `worker` use `condition: service_healthy` against `db`. The
netcat probe in `entrypoint.sh` becomes a backstop, not the primary
gate.

### Gunicorn

```
gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers ${GUNICORN_WORKERS:-3} \
  --timeout ${GUNICORN_TIMEOUT:-120} \
  --access-logfile - \
  --error-logfile -
```

For a 30-person department, default 3 workers covers expected concurrency
without overcommitting CPU. Configurable via env.

## Acceptance Criteria

1. `docker compose -f docker-compose.prod.yml build` runs the backend
   build context exactly once (verifiable via `docker compose build
   --progress=plain | grep -c "FROM python:3.11-slim AS"` showing two
   stages, not four).
2. `docker images biodjango-backend` shows a single tag used by both
   `web` and `worker`.
3. `docker images biodjango-backend:local --format '{{.Size}}'` is
   smaller than the v2.7 backend image (target: at least 200 MB
   smaller after dropping `build-essential` and `gcc` from runtime).
4. Editing a Python file under `backend/` and rebuilding only
   re-executes the `COPY backend/ /app/` layer; the apt and pip layers
   stay cached.
5. Editing `frontend/src/App.tsx` and rebuilding only re-executes
   `npm run build`; the `npm ci` layer stays cached.
6. `curl -fsS http://<host>/django_static/admin/css/base.css` returns
   200 OK (admin CSS reachable).
7. `docker compose -f docker-compose.prod.yml up -d` on a fresh volume
   produces exactly one set of migration log lines, originating from
   the `web` container.
8. Booting `docker compose -f docker-compose.prod.yml up` with
   `SECRET_KEY` unset exits non-zero before any container starts.
9. `cp .env.example .env` from a fresh clone yields a file that, with
   only `SECRET_KEY` and `POSTGRES_PASSWORD` filled in, brings the
   stack up green.
