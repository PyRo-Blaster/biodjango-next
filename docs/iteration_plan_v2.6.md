# Iteration Plan: BioDjango v2.6.0

## Overview

This iteration focuses on **Security Updates & Deployment Fixes** to resolve Docker deployment issues reported by users. The primary goals are to fix the frontend-backend connection problems, improve deployment automation, and simplify the deployment process.

## 1. Problem Statement

Users have reported the following issues when deploying to Ubuntu Server with Docker:

1. **Frontend cannot connect to Backend**: Browser shows "Connection Refused" when accessing the API
2. **Docker deployment is difficult**: Complex multi-step deployment process requiring manual frontend build
3. **CORS errors**: Cross-origin requests are blocked in some configurations
4. **ALLOWED_HOSTS issues**: Django returns 400 errors due to incorrect host configuration

Root causes identified:
- Frontend API URL is hardcoded to `http://localhost:8000`
- `entrypoint.sh` database wait condition never triggers (checks wrong env var)
- Nginx lacks file upload size configuration (`client_max_body_size`)
- Production deployment requires manual frontend build before Docker
- No health checks to ensure proper service startup order
- Static files not automatically collected

## 2. Feature Specifications

### Phase 0: Pre-requisite Fixes (NEW - Critical)

#### 0.1 Fix entrypoint.sh Database Wait Condition

**Problem**: `entrypoint.sh` checks `DATABASE=postgres` but this variable is never set in docker-compose

**Solution**: Change condition to check `SQL_ENGINE` instead:
```bash
if [ "$SQL_ENGINE" = "django.db.backends.postgresql" ]
```

#### 0.2 Add Nginx File Upload Configuration

**Problem**: Large file uploads (FASTA sequences) fail due to missing `client_max_body_size`

**Solution**: Add to `nginx/nginx.conf`:
```nginx
client_max_body_size 100M;
```

#### 0.3 Add Health Check Endpoint

**Problem**: No way to verify backend is ready before nginx starts proxying

**Solution**: Add unauthenticated health endpoint at `/api/health/`

### Phase 1: Core Fixes (Critical)

#### 1.1 Fix Frontend API Configuration

**Problem**: Frontend hardcodes `http://localhost:8000` in production builds

**Solution**:
- Modify `frontend/src/api/client.ts` to use relative path `/api`
- Fix refresh token URL to avoid double `/api/api/` path
- Request goes through Nginx proxy in production

#### 1.2 Fix Django Security Settings

**Problem**: ALLOWED_HOSTS not configured for Docker network

**Solution**:
- Update default `ALLOWED_HOSTS` to include Docker service name `web`
- Keep `CORS_ALLOW_ALL_ORIGINS` default as `False` (not needed with Nginx proxy)
- Add environment variable validation

#### 1.3 Improve Nginx Reverse Proxy Configuration

**Problem**: Nginx proxy incomplete, missing timeout and WebSocket support

**Solution**: Enhance nginx.conf with:
- Proper timeout settings (connect, send, read)
- WebSocket support for future real-time features
- Better error handling

### Phase 2: Deployment Improvements (High)

#### 2.1 Create Integrated nginx.Dockerfile

**Problem**: Current setup requires manual frontend build before Docker deployment

**Solution**: Create multi-stage `nginx.Dockerfile` that:
- Stage 1: Builds React app with Node
- Stage 2: Serves with Nginx Alpine
- Eliminates need for manual pre-build step

#### 2.2 Update docker-compose.prod.yml

**Problem**: nginx service mounts local `./frontend/dist` directory

**Solution**:
- Change nginx service to use `build` instead of mounting local directory
- Add health check configurations
- Add `env_file` support
- Provide default values for optional environment variables

#### 2.3 Add Static Files Auto-collection

**Problem**: `collectstatic` must be run manually after deployment

**Solution**: Add to `entrypoint.sh`:
```bash
python manage.py collectstatic --noinput
```

#### 2.4 Add Environment Variable Templates

**Problem**: Users don't know what environment variables to configure

**Solution**: Create `.env.example` with all required variables documented

### Phase 3: Documentation & Testing (High)

#### 3.1 Update Deployment Documentation

**Problem**: DEPLOY.md is incomplete and doesn't cover all scenarios

**Solution**: Comprehensive update including:
- Simplified deployment steps (single command)
- Environment variable reference
- Troubleshooting section with common errors

#### 3.2 Docker Deployment Testing

- Test production deployment on clean Ubuntu VM
- Verify frontend-backend connection
- Test all API endpoints

## 3. Implementation Roadmap

```
Phase 0: Pre-requisite Fixes (Must complete first)
    │
    ├── 0.1 Fix entrypoint.sh condition
    ├── 0.2 Add nginx client_max_body_size
    └── 0.3 Add health check endpoint
    │
    ▼
Phase 1: Core Fixes (Critical)
    │
    ├── 1.1 Frontend API URL fix (with refresh token fix)
    ├── 1.2 Django ALLOWED_HOSTS fix
    └── 1.3 Nginx configuration enhancement
    │
    ▼
Phase 2: Deployment Improvements (High)
    │
    ├── 2.1 Create nginx.Dockerfile (multi-stage)
    ├── 2.2 Update docker-compose.prod.yml
    ├── 2.3 Add collectstatic to entrypoint.sh
    └── 2.4 Create .env.example
    │
    ▼
Phase 3: Documentation & Testing (High)
    │
    ├── 3.1 Rewrite DEPLOY.md
    └── 3.2 Full deployment testing
```

## 4. Technical Details

### 4.1 entrypoint.sh Fix

```bash
# Before - condition never true
if [ "$DATABASE" = "postgres" ]

# After - checks actual environment variable
if [ "$SQL_ENGINE" = "django.db.backends.postgresql" ]
```

### 4.2 Frontend API Client Change

```typescript
// Before
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// After - use relative path for production
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Also fix refresh token request (line 36)
// Before: `${API_BASE_URL}/api/auth/refresh/`
// After:  `${API_BASE_URL}/auth/refresh/` (remove duplicate /api)
```

### 4.3 nginx.Dockerfile (Multi-stage Build)

```dockerfile
# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Nginx Runtime
FROM nginx:alpine
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 4.4 Health Check Endpoint

```python
# In urls.py - no authentication required
from django.http import JsonResponse

urlpatterns = [
    path('api/health/', lambda r: JsonResponse({'status': 'ok'})),
    # ... other urls
]
```

### 4.5 Docker Compose Health Check

```yaml
services:
  web:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health/"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    depends_on:
      web:
        condition: service_healthy
```

## 5. Files to Modify

| File | Change Type | Priority | Phase |
|------|-------------|----------|-------|
| `backend/entrypoint.sh` | Modify | Critical | 0 |
| `nginx/nginx.conf` | Modify | Critical | 0 |
| `backend/config/urls.py` | Modify | Critical | 0 |
| `frontend/src/api/client.ts` | Modify | Critical | 1 |
| `backend/config/settings.py` | Modify | Critical | 1 |
| `nginx.Dockerfile` | Create | High | 2 |
| `docker-compose.prod.yml` | Modify | High | 2 |
| `.env.example` | Create | High | 2 |
| `DEPLOY.md` | Rewrite | High | 3 |

## 6. Backward Compatibility

- Development mode (`npm run dev`) will still work with localhost
- Existing deployments with custom `VITE_API_URL` will continue to work
- Production deployments will benefit from improved automation
- CORS settings remain unchanged (default False) - more secure

## 7. Security Considerations

### CORS Configuration (Important Change from Original Plan)

**Original plan**: Change `CORS_ALLOW_ALL_ORIGINS` default to `True`

**Revised approach**: Keep default as `False`

**Rationale**:
- With proper Nginx reverse proxy, frontend and backend share the same origin
- CORS is not needed when both are served from the same domain
- `CORS_ALLOW_ALL_ORIGINS=True` is a security risk and unnecessary
- Only enable CORS for special deployments (separate frontend/backend domains)

## 8. Testing Checklist

- [ ] entrypoint.sh waits for PostgreSQL correctly
- [ ] Frontend builds successfully in Docker
- [ ] Docker Compose starts all services with single command
- [ ] Health check endpoint responds
- [ ] Browser can access frontend
- [ ] API requests go through Nginx proxy
- [ ] Large file uploads (>1MB) work
- [ ] Login/Authentication works
- [ ] Static files (CSS/JS) load correctly
- [ ] Django Admin accessible with styles
- [ ] BLAST/MSA analysis functions work

## 9. Success Criteria

1. User can deploy with single command: `docker-compose -f docker-compose.prod.yml up -d --build`
2. No manual frontend build step required
3. Frontend connects to backend without errors
4. All environment variables are documented in `.env.example`
5. Deployment works on fresh Ubuntu Server 22.04
6. No hardcoded localhost references in production builds
7. Large file uploads work correctly
