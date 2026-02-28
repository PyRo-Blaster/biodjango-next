# BioDjango v2.6.0 Production Deployment Guide

## Overview

This guide covers deploying BioDjango to a production server using Docker Compose. **v2.6.0 simplifies the deployment to a single command.**

---

## Prerequisites

- Ubuntu Server 20.04/22.04 (or any Linux server with Docker)
- Docker & Docker Compose v2+
- BLAST Database (optional, for sequence analysis)

---

## Quick Start

### Step 1: Clone and Configure

```bash
# Clone the project
git clone <repository-url>
cd biodjango-next

# Copy environment template
cp .env.example .env
```

### Step 2: Edit .env

Edit the `.env` file and set your values:

```bash
# Required: Generate a secure secret key
SECRET_KEY=your-super-secret-key-here

# Required: Set your domain or server IP
DJANGO_ALLOWED_HOSTS=localhost 127.0.0.1 [::1] web your-server-ip

# Required: Database password
POSTGRES_PASSWORD=your-secure-password

# Optional: BLAST database path (create this directory first)
BLAST_DB_PATH=/mnt/data/blastdb
```

### Step 3: Deploy (Single Command)

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

That's it! The deployment will:
1. Build the frontend (Node.js)
2. Build the backend (Django + Gunicorn)
3. Start PostgreSQL, Redis, Backend, Worker, and Nginx
4. Run database migrations
5. Collect static files
6. Verify health with the health check endpoint

---

## Verify Deployment

### Check Services

```bash
docker-compose -f docker-compose.prod.yml ps
```

All services should show `Up` status.

### Test Health Endpoint

```bash
curl http://localhost/api/health/
# Expected: {"status": "ok"}
```

### Access Application

- Frontend: `http://your-server-ip`
- API: `http://your-server-ip/api/`
- Admin: `http://your-server-ip/admin/`

---

## Common Issues & Solutions

### 1. Frontend shows "Connection Refused" to API

**Cause**: Frontend trying to connect to wrong API URL.

**Solution**: 
- Ensure you're accessing via Nginx on port 80
- The fix is already applied in v2.6.0 (frontend uses relative `/api` path)

### 2. Django returns 400 Bad Request

**Cause**: Host not in ALLOWED_HOSTS.

**Solution**: Update `.env`:
```bash
DJANGO_ALLOWED_HOSTS=localhost 127.0.0.1 [::1] web your-server-ip
```

### 3. Database connection fails

**Cause**: PostgreSQL not ready when Django starts.

**Solution**: Fixed in v2.6.0 - entrypoint now waits for database.

### 4. Large file uploads fail (413 error)

**Cause**: Nginx body size limit exceeded.

**Solution**: Fixed in v2.6.0 - `client_max_body_size` set to 100MB.

### 5. Cannot access services

**Cause**: Firewall blocking ports.

**Solution**:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp  # if using SSL
```

---

## Managing the Application

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f web
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Restart Services

```bash
docker-compose -f docker-compose.prod.yml restart
```

### Stop Services

```bash
docker-compose -f docker-compose.prod.yml down
```

### Update and Redeploy

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build
```

### Database Migrations

Migrations run automatically on startup. To run manually:

```bash
docker-compose -f docker-compose.prod.yml exec web python manage.py migrate
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | - | Django secret key |
| `DEBUG` | No | `0` | Set to `1` for debugging |
| `DJANGO_ALLOWED_HOSTS` | Yes | `localhost 127.0.0.1 [::1] web` | Allowed hostnames |
| `POSTGRES_DB` | No | `biodjango` | Database name |
| `POSTGRES_USER` | No | `postgres` | Database user |
| `POSTGRES_PASSWORD` | Yes | - | Database password |
| `POSTGRES_HOST` | No | `db` | Database host |
| `POSTGRES_PORT` | No | `5432` | Database port |
| `BLAST_DB_PATH` | No | `./blastdb` | BLAST database directory |
| `CELERY_BROKER_URL` | No | `redis://redis:6379/0` | Celery broker |
| `CELERY_RESULT_BACKEND` | No | `redis://redis:6379/0` | Celery result backend |

---

## Architecture

```
                    ┌─────────────┐
                    │   Nginx     │
                    │  (Port 80)  │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────▼─────┐           ┌──────▼──────┐
        │  Frontend │           │    API      │
        │  (Static)│           │  (Django)   │
        └───────────┘           └──────┬──────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
             ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐
             │  PostgreSQL │    │   Redis    │    │    Worker   │
             │   (Data)    │    │  (Celery)  │    │  (Tasks)    │
             └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Troubleshooting Commands

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' biodjango-next-web-1

# Access container shell
docker exec -it biodjango-next-web-1 sh

# Check Nginx logs
docker logs biodjango-next-nginx-1

# Verify database connection
docker exec -it biodjango-next-web-1 python manage.py dbshell
```

---

## Security Notes

1. **Change SECRET_KEY** in production
2. **Use strong POSTGRES_PASSWORD**
3. **Enable HTTPS** with a reverse proxy (optional)
4. **Keep DEBUG=False** in production
5. **Regularly update** Docker images and dependencies
