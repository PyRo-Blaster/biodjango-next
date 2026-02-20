# BioDjango Production Deployment Guide

## Prerequisites
- Ubuntu Server (or any Linux server with Docker installed)
- Docker & Docker Compose
- BLAST Database (e.g., `/mnt/data/blastdb`)

## 1. Environment Configuration
Create a `.env` file in the project root:

```bash
# BLAST Database Path (Host)
BLAST_DB_PATH=/mnt/data/blastdb

# Django Settings
SECRET_KEY=your-secure-secret-key
DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost 127.0.0.1 [::1] web your-domain.com

# Database Settings
POSTGRES_DB=biodjango
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-db-password
POSTGRES_HOST=db
POSTGRES_PORT=5432
```

## 2. Build Frontend
Before deploying with Docker Compose, you need to build the frontend assets locally (or use a multi-stage Dockerfile).
Since `docker-compose.prod.yml` mounts `./frontend/dist`, you must run:

```bash
cd frontend
npm install
npm run build
cd ..
```

## 3. Deploy
Run the production compose file:

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

## 4. Collect Static Files (Backend)
To serve Django Admin styles correctly:

```bash
docker-compose -f docker-compose.prod.yml exec web python manage.py collectstatic --noinput
```

## 5. Verify
Access `http://your-server-ip` or `http://your-domain.com`.

- Frontend should load on port 80.
- API calls to `/api/...` should be proxied to Django.
- BLAST/MSA tasks should be processed by the worker.

## Troubleshooting
- **BLAST DB**: Ensure the host path in `.env` exists and is readable.
- **Logs**: `docker-compose -f docker-compose.prod.yml logs -f`
