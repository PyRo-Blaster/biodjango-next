# BioDjango Next Generation (v2.9)

BioDjango is a full-stack bioinformatics platform built with Django REST Framework and React.  
Version `v2.9` focuses on production deployment hardening and beta debugging readiness.

## What's New in v2.9

- Production stack uses a single backend image shared by `web` and `worker`.
- Only `web` runs `migrate` and `collectstatic`; `worker` runs Celery only.
- Static assets are aligned through `/django_static/` in Nginx + Django.
- Frontend production build uses committed lockfile with `npm ci`.
- Compose startup uses required env var fail-fast checks.
- Frontend protected pages now enforce auth routing before API calls.

## Core Features

- Project management with private/public access and request/approval workflow.
- Sequence analysis, peptide calculator, BLAST search, and MSA workflows.
- Primer design and antibody annotation tools.
- JWT-based auth with refresh flow.

## Tech Stack

- Backend: Django, Django REST Framework, Celery, Redis, PostgreSQL
- Frontend: React, TypeScript, Tailwind CSS, Vite
- Infrastructure: Docker Compose, Nginx

## Quick Start

### Development

```bash
docker compose up -d --build
```

Frontend: [http://localhost:5173](http://localhost:5173)

### Beta / Production-Like

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml up -d --build
```

Verify:

```bash
docker compose -f docker-compose.prod.yml ps
curl -fsS http://localhost/api/health/
curl -fsS http://localhost/django_static/admin/css/base.css | head -c 100
```

## Release Notes for GitHub v2.9

- Recommended release tag: `v2.9.0`
- Include docs updates (`README.md`, `DEPLOY.md`) in the same release commit.
- Use production compose file for beta debugging validation before tagging.
- Container build context excludes common test files in `.dockerignore` to reduce image size.

## Documentation

- `DEPLOY.md`: v2.9 production deployment guide and release workflow.
- `docs/execution_checklist_v2.8_v2.9.md`: implementation checklist.
- `docs/iteration_plan_v2.8.md`: iteration plan and acceptance baseline.
- `docs/beta_test_guide_v2.7.md`: beta test process and feedback template.
