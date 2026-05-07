# BioDjango V2.8-V2.9 Execution Checklist

## Scope

This checklist translates the approved v2.8 and v2.9 iteration plans into a
file-by-file execution order for the development team. The recommended delivery
sequence is:

1. v2.8 backend permissions, routes, and analysis auth
2. v2.8 backend tests
3. v2.8 frontend request-layer consolidation
4. v2.8 frontend cleanup and verification
5. v2.9 backend image and compose topology
6. v2.9 static files alignment
7. v2.9 frontend image lockfile and Docker cleanup
8. v2.9 deployment documentation

## V2.8 Batch 1: Backend Permissions And Routes

### Files

- Modify: `backend/projects/permissions.py`
- Modify: `backend/projects/views.py`
- Modify: `backend/projects/urls.py`
- Modify: `backend/projects/serializers.py`
- Modify: `backend/analysis/views.py`
- Modify: `backend/analysis/throttles.py`
- Modify: `backend/config/settings.py`

### Deliverables

- Replace admin-only project writes with owner-or-staff writes.
- Allow project owners to approve access requests.
- Return `403` for inaccessible sequence listings instead of an empty list.
- Remove `/api/projects/projects/` route doubling.
- Require authentication for all analysis endpoints.
- Introduce a dedicated throttle scope for analysis task polling.
- Add an `ENABLE_PAGINATION` guard for safe rollout of paginated project lists.

### Verification

- Authenticated non-staff user can create a project.
- Non-owner receives `403` on project mutation.
- Project owner or staff can review an access request.
- Anonymous calls to `/api/analysis/*` return `401`.
- `/api/projects/<id>/` resolves under the corrected route layout.

## V2.8 Batch 2: Backend Tests

### Files

- Modify: `backend/projects/tests.py`
- Modify: `backend/analysis/tests.py`

### Deliverables

- Add project ownership and review permission coverage.
- Add inaccessible sequence-list `403` coverage.
- Replace anonymous analysis acceptance tests with authentication tests.
- Add analysis task polling throttle coverage for authenticated users.

### Verification

- `python manage.py test projects analysis`
- Confirm the new tests fail before backend changes and pass afterward.

## V2.8 Batch 3: Frontend Request Layer

### Files

- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/auth.ts`
- Modify: `frontend/src/api/projects.ts`
- Modify: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/Register.tsx`
- Modify: `frontend/src/pages/ProjectsList.tsx`
- Modify: `frontend/src/pages/ProjectDetail.tsx`
- Modify: `frontend/src/pages/AdminDashboard.tsx`
- Delete: `frontend/src/main.tsx.bak`

### Deliverables

- Use a single `apiClient` for all authenticated requests.
- Remove raw `axios` usage outside `src/api/client.ts`.
- Stop mutating `axios.defaults` in `AuthContext`.
- Switch project URLs to `/projects/...` relative paths with no `/api` prefix.
- Update project list handling to consume paginated responses.
- Remove UI-only staff gate for project creation and FASTA upload.

### Verification

- `grep -R "axios\\." frontend/src`
- `grep -R "/api/api/" frontend/src`
- `npm run lint`
- Manual login, registration, project creation, access request, and FASTA upload

## V2.8 Batch 4: Frontend And End-To-End Verification

### Files

- Optional: `frontend/src/api/__tests__/client.test.ts`

### Deliverables

- Optional refresh-flow regression coverage for `apiClient`.
- Manual QA pass for owner approval, student access, and BLAST polling.

### Verification

- Run the manual QA steps defined in `docs/iteration_plan_v2.8.md`.

## V2.9 Batch 1: Backend Image And Entrypoints

### Files

- Modify: `backend/Dockerfile`
- Modify: `backend/entrypoint.sh`
- Create: `backend/entrypoint-worker.sh`
- Create or modify: `backend/.dockerignore`

### Deliverables

- Convert backend image to a builder/runtime multi-stage Dockerfile.
- Keep migrations and collectstatic in the web entrypoint only.
- Add a worker entrypoint that waits for Postgres but skips migrations.
- Reduce backend build context size.

### Verification

- `docker compose -f docker-compose.prod.yml build`
- Confirm backend image uses two stages and is built once.

## V2.9 Batch 2: Compose Topology

### Files

- Modify: `docker-compose.prod.yml`
- Modify: `docker-compose.yml`

### Deliverables

- Build the backend image once and reuse it for `web` and `worker`.
- Add `db`, `redis`, and `web` health checks.
- Gate `worker` startup on healthy `web`.
- Fail fast when required environment variables are missing.

### Verification

- `docker compose -f docker-compose.prod.yml up -d`
- Confirm only `web` runs migrations.
- Confirm unset required env vars stop startup immediately.

## V2.9 Batch 3: Static Files Alignment

### Files

- Modify: `backend/config/settings.py`
- Verify: `nginx/nginx.conf`

### Deliverables

- Set `STATIC_URL = "/django_static/"`.
- Set `STATIC_ROOT = BASE_DIR / "static"`.
- Align Django static output with the nginx alias and mounted volume.

### Verification

- `curl -fsS http://localhost/django_static/admin/css/base.css`
- Confirm Django admin static assets load through nginx.

## V2.9 Batch 4: Frontend Image Cleanup

### Files

- Create: `frontend/package-lock.json`
- Modify: `frontend/Dockerfile`
- Modify: `nginx.Dockerfile`
- Create: `frontend/.dockerignore`
- Optional: tighten root `.dockerignore`

### Deliverables

- Commit a lockfile and switch frontend builds to `npm ci`.
- Remove runtime `npm install` behavior from Dockerfiles.
- Improve frontend layer caching and reproducibility.

### Verification

- `docker compose -f docker-compose.prod.yml build nginx`
- Confirm the `npm ci` layer is cached across source-only edits.

## V2.9 Batch 5: Deployment Documentation

### Files

- Create: `.env.example`
- Modify: `DEPLOY.md`

### Deliverables

- Ship a working environment template.
- Document required variables, first-time deploy flow, and new worker behavior.
- Document the static volume reset step for legacy deployments.

### Verification

- `cp .env.example .env`
- Fill `SECRET_KEY` and `POSTGRES_PASSWORD`
- `docker compose -f docker-compose.prod.yml up -d`

## PR Guidance

- Keep v2.8 and v2.9 in separate pull requests.
- Prefer one PR per batch to simplify review and rollback.
- For each PR include:
  - changed files
  - validation commands
  - rollback note
