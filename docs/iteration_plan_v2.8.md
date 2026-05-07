# Iteration Plan: BioDjango v2.8.0

## Overview

This plan implements `docs/spec_v2.8.md`. Work is split into four phases that
can be reviewed and merged independently. Phases 1 and 2 are backend-only.
Phase 3 is frontend-only and depends on Phase 1 (URL doubling fix). Phase 4
is test coverage.

Docker compose / image-build optimizations are explicitly **out of scope**
and tracked separately under v2.9.

## Phase Order and Dependencies

```
Phase 1 (BE perms + URLs)  ──►  Phase 3 (FE consolidation)
            │
            ▼
Phase 2 (BE throttles)     ──►  Phase 4 (tests)
```

Phase 1 must land first because Phase 3 depends on the corrected URL layout.
Phase 2 can land in parallel with Phase 1.

---

## Phase 1: Backend Permissions and URL Cleanup

### 1.1 New permission classes

Edit `backend/projects/permissions.py`. Replace `IsAdminOrReadOnly` with two
classes that match the new ownership model.

```python
# backend/projects/permissions.py
from rest_framework import permissions


class IsOwnerOrStaffOrReadOnly(permissions.BasePermission):
    """Object-level: read for anyone with project access; write for owner/staff."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        return getattr(obj, "owner_id", None) == user.id


class HasProjectAccess(permissions.BasePermission):
    """Object-level read access: staff, owner, allow-listed user, or public."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_staff:
            return True
        if obj.owner_id == user.id:
            return True
        if getattr(obj, "is_public", False) and request.method in permissions.SAFE_METHODS:
            return True
        if request.method in permissions.SAFE_METHODS:
            return obj.allowed_users.filter(id=user.id).exists()
        return False


class CanReviewAccessRequest(permissions.BasePermission):
    """Approve/reject is allowed for staff or the project owner."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        return bool(user and user.is_authenticated and (
            user.is_staff or obj.project.owner_id == user.id
        ))
```

### 1.2 Open project create to authenticated users

Edit `backend/projects/views.py:27-32`:

```python
def get_permissions(self):
    if self.action in ("create",):
        return [permissions.IsAuthenticated()]
    if self.action in ("update", "partial_update", "destroy", "upload_fasta"):
        return [permissions.IsAuthenticated(), IsOwnerOrStaffOrReadOnly()]
    if self.action == "retrieve":
        return [permissions.IsAuthenticated(), HasProjectAccess()]
    return [permissions.IsAuthenticated()]
```

`perform_create` already sets `owner=self.request.user`; no change needed
once `IsAdminUser` is removed.

### 1.3 Owner can review access requests

Edit `backend/projects/views.py:137`:

```python
@action(
    detail=True,
    methods=["patch"],
    permission_classes=[permissions.IsAuthenticated, CanReviewAccessRequest],
)
def review(self, request, pk=None):
    ...
```

### 1.4 Fix `ProteinSequenceViewSet` permission flow

Replace the manual `HasProjectAccess` invocation in `get_queryset`
(`backend/projects/views.py:103-122`) with proper DRF object-level checks:

```python
class ProteinSequenceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProteinSequenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        project_id = self.request.query_params.get("project_id")
        if not project_id:
            return ProteinSequence.objects.none()
        project = get_object_or_404(Project, id=project_id)
        self.check_object_permissions(self.request, project)
        return project.sequences.select_related("project").all()
```

`HasProjectAccess` raises 403 instead of returning an empty list, which
matches the spec.

### 1.5 Require auth on analysis endpoints

Edit every view in `backend/analysis/views.py`. Replace
`permission_classes = [AllowAny]` with `permission_classes = [IsAuthenticated]`
on:

- `AnalysisTaskViewSet`
- `BlastTaskView`
- `MsaTaskView`
- `PeptideCalcView`
- `SequenceAnalysisView`
- `PrimerDesignView`
- `AntibodyAnnotationView`

Drop the `AnonBurstRateThrottle` from each view's `throttle_classes`
(see Phase 2 for the new scope).

### 1.6 URL doubling fix

Two options. Pick exactly one.

**Option A (recommended): change the inner basename.** Edit
`backend/projects/urls.py`:

```python
router.register(r"", ProjectViewSet, basename="projects")
router.register(r"sequences", ProteinSequenceViewSet, basename="sequences")
router.register(r"access-requests", AccessRequestViewSet, basename="access-requests")
```

Routes resolve to `/api/projects/`, `/api/projects/sequences/`,
`/api/projects/access-requests/`. The detail route lands at
`/api/projects/{id}/`, which is what the frontend expects in v2.8.

**Option B: change the include prefix.** Edit `backend/config/urls.py:21`
to mount `projects.urls` at `/api/` instead of `/api/projects/`. Cleaner
but collides with the legacy `core` router that also exposes `projects`.
Use only if you also retire `core.ProjectViewSet`.

This plan assumes Option A.

### 1.7 Reduce N+1 on project list

Edit `ProjectViewSet.get_queryset` to prefetch:

```python
return Project.objects.select_related("owner").prefetch_related(
    "allowed_users", "access_requests"
).all()
```

Update `ProjectSerializer.get_access_status` and `get_is_allowed`
(`backend/projects/serializers.py:26-43`) to consume the prefetched
collections in Python instead of querying again per row.

### 1.8 Migration impact

None. No model fields change in this phase.

### 1.9 Phase 1 deliverables

- `backend/projects/permissions.py` — three permission classes.
- `backend/projects/views.py` — updated `get_permissions`, `review`, and
  `ProteinSequenceViewSet`.
- `backend/projects/urls.py` — basename change.
- `backend/projects/serializers.py` — N+1 fix.
- `backend/analysis/views.py` — `IsAuthenticated` on all views.

---

## Phase 2: Throttle Re-tuning

### 2.1 Settings

Edit `backend/config/settings.py:142-155`:

```python
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "user": "120/min",
        "task_poll": "600/min",
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}
```

`anon_burst` and `user_burst` scopes are removed; nothing references them
once Phase 1 lands.

### 2.2 Polling scope

Edit `backend/analysis/throttles.py`:

```python
from rest_framework.throttling import UserRateThrottle


class TaskPollThrottle(UserRateThrottle):
    scope = "task_poll"
```

In `AnalysisTaskViewSet` (`backend/analysis/views.py:24`), set:

```python
throttle_classes = [TaskPollThrottle]
```

Remove the bespoke `AuthenticatedRateThrottle` from the other analysis
views (the global default now covers them).

### 2.3 Pagination compatibility

Frontend list calls currently expect a bare array. After enabling
pagination, responses become `{count, next, previous, results}`. Phase 3
updates the frontend to read `.results`. Until Phase 3 ships, gate
pagination behind a feature flag if Phase 2 lands first:

```python
"DEFAULT_PAGINATION_CLASS": (
    "rest_framework.pagination.PageNumberPagination"
    if os.environ.get("ENABLE_PAGINATION", "0") == "1"
    else None
),
```

Drop the flag once Phase 3 is merged.

### 2.4 Phase 2 deliverables

- `backend/config/settings.py` — DRF block updated.
- `backend/analysis/throttles.py` — `TaskPollThrottle` added,
  `AnonBurstRateThrottle`/`AuthenticatedRateThrottle` removed.
- `backend/analysis/views.py` — `throttle_classes` updated per view.

---

## Phase 3: Frontend Request Layer Consolidation

### 3.1 Fix `apiClient` base behavior

Edit `frontend/src/api/client.ts`:

- Keep `baseURL = import.meta.env.VITE_API_URL || '/api'`.
- Remove the `PUBLIC_API_PREFIXES` carve-out from the 401 interceptor —
  with v2.8 there are no public endpoints, so any 401 should attempt
  refresh exactly once and then fail to login.
- Keep the existing 429/`Retry-After` plumbing in `handleApiError`.

### 3.2 Rewrite `src/api/auth.ts`

```typescript
import { apiClient } from "./client";

interface TokenPair { access: string; refresh: string; }
interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post<TokenPair>("/auth/token/", { username, password })
      .then(r => r.data),

  refresh: (refresh: string) =>
    apiClient.post<{ access: string }>("/auth/token/refresh/", { refresh })
      .then(r => r.data),

  register: (data: RegisterData) =>
    apiClient.post("/auth/register/", data).then(r => r.data),
};
```

There is no `logout` HTTP call. `AuthContext.logout` only clears
`localStorage` and React state. A real blacklist endpoint is a v2.9 item.

### 3.3 Rewrite `src/api/projects.ts`

All paths drop the leading `/api`. The list endpoint returns paginated
data after Phase 2.

```typescript
import { apiClient } from "./client";

export interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[]; }

export const projectsApi = {
  list: () =>
    apiClient.get<Paginated<Project>>("/projects/").then(r => r.data.results),

  get: (id: string) =>
    apiClient.get<ProjectDetail>(`/projects/${id}/`).then(r => r.data),

  create: (data: Partial<Project>) =>
    apiClient.post<Project>("/projects/", data).then(r => r.data),

  update: (id: string, data: Partial<Project>) =>
    apiClient.patch<Project>(`/projects/${id}/`, data).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/projects/${id}/`).then(() => undefined),

  uploadFasta: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient.post(`/projects/${id}/upload_fasta/`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },

  requestAccess: (projectId: string, reason: string) =>
    apiClient.post("/projects/access-requests/", { project: projectId, reason })
      .then(r => r.data),
};
```

Note `id` is a UUID string — the v2.7 type used `number`, which was wrong.

### 3.4 Migrate page-level call sites

For each page below, replace raw `axios` with `apiClient` (or with the
typed module if a method exists). Drop the `/api` prefix from all URLs.

| File | Action |
|------|--------|
| `frontend/src/pages/Login.tsx:21` | `authApi.login(...)` |
| `frontend/src/pages/Register.tsx:32` | `authApi.register(...)` |
| `frontend/src/pages/ProjectsList.tsx:39,56,69` | `projectsApi.list()`, `.create(...)`, `.requestAccess(...)` |
| `frontend/src/pages/ProjectDetail.tsx:35,38,62` | `projectsApi.get(...)`, sequences fetch via `apiClient.get('/projects/sequences/?project_id=...')`, `projectsApi.uploadFasta(...)` |
| `frontend/src/pages/AdminDashboard.tsx:36,45,63` | `apiClient.get('/projects/access-requests/')`, `apiClient.get('/core/audit-logs/')`, `apiClient.patch('/projects/access-requests/{id}/review/', ...)` |

### 3.5 Stop mutating `axios.defaults`

Edit `frontend/src/context/AuthContext.tsx`:

- Remove `axios.defaults.headers.common['Authorization'] = ...` from
  `useEffect` and from `login`.
- Remove `delete axios.defaults.headers.common['Authorization']` from
  `logout`.
- The `apiClient` request interceptor reads `localStorage` per request,
  so no global state is needed.

This eliminates the startup race described in the v2.8 spec.

### 3.6 Cleanups

- Delete `frontend/src/main.tsx.bak`.
- Run `eslint --fix` on the changed files.
- Add a single ESLint rule (or a CI grep) banning bare `axios.` imports
  outside `src/api/client.ts`.

### 3.7 Phase 3 deliverables

- Rewritten `src/api/client.ts`, `src/api/auth.ts`, `src/api/projects.ts`.
- Migrated pages: `Login`, `Register`, `ProjectsList`, `ProjectDetail`,
  `AdminDashboard`.
- `AuthContext` no longer touches `axios.defaults`.
- `main.tsx.bak` removed.

---

## Phase 4: Tests

### 4.1 Backend

Add to `backend/projects/tests.py`:

- A non-staff user can `POST /api/projects/` and becomes the owner.
- A second non-staff user gets 403 on `PATCH /api/projects/{owned_by_other}/`.
- Staff can `PATCH` any project.
- Project owner can approve their own project's access request.
- Non-owner non-staff user gets 403 on `review`.
- `GET /api/projects/sequences/?project_id=<inaccessible>` returns 403,
  not an empty list.

Add to `backend/analysis/tests.py`:

- Anonymous `POST /api/analysis/blast/` returns 401.
- Authenticated user can poll `/api/analysis/tasks/{id}/` 100 times in
  60s without 429 (uses `override_settings` to set `task_poll` rate).

### 4.2 Frontend

Optional but recommended: add a thin Vitest suite covering
`apiClient`'s 401 refresh flow with `axios-mock-adapter`. Not a release
blocker; add it under `frontend/src/api/__tests__/client.test.ts` if
time permits.

### 4.3 Manual QA

Walk through, against a fresh database:

1. Register two non-staff users `pi` and `student`.
2. As `pi`, create project "Lab A". Upload a 10-sequence FASTA.
3. Log in as `student`. Confirm "Lab A" is visible in the list with
   "Request Access". Submit a request.
4. Log back in as `pi`. Approve the request from the project detail
   page (or admin dashboard if owner-side review UI is not yet wired).
5. As `student`, view "Lab A" sequences. Run a BLAST. Confirm the task
   page polls without throttling.
6. As `student`, attempt `DELETE /api/projects/{lab_a_id}/` via curl.
   Confirm 403.

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| URL change in 1.6 breaks any out-of-tree consumer | Low | No external consumers known; document in CHANGELOG |
| Pagination flip in 2.3 breaks UI if Phase 3 lags | Medium | Feature flag `ENABLE_PAGINATION`, default off until Phase 3 lands |
| Removing `axios.defaults` breaks any page not migrated | Medium | Phase 3.6 grep gate catches stragglers |
| Owner-can-review widens approval surface | Low | Document in release notes; staff retains override |

## Out of Scope (Tracked for v2.9)

- Single-build backend image (`web` and `worker` share one image).
- Multi-stage backend Dockerfile to drop `build-essential` from runtime.
- Frontend Dockerfile: lockfile + `npm ci`.
- `STATIC_ROOT` vs. `static_volume` mount mismatch.
- Migrations gate so only `web` runs `migrate` on cold start.
- `.env.example` checked in.
- Refresh-token blacklist endpoint and a real `logout` HTTP call.
