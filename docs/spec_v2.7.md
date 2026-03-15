# Technical Specification: BioDjango v2.7.0

## 1. Design Goals

1. Enable anonymous access for all analysis tools.
2. Preserve authentication requirements for core/projects modules.
3. Prevent abuse by enforcing anonymous throttling.
4. Make frontend behavior deterministic for 401 and 429 responses.
5. Avoid partial rollout gaps by standardizing all tool API calls.

## 2. Backend Specification

### 2.1 Throttle Classes

**File**: `backend/analysis/throttles.py` (NEW)

```python
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class AnonBurstRateThrottle(AnonRateThrottle):
    scope = "anon_burst"


class AuthenticatedRateThrottle(UserRateThrottle):
    scope = "user_burst"
```

`rate` is configured centrally in Django settings for consistency across environments.

### 2.2 DRF Settings

**File**: `backend/config/settings.py`

```python
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {
        "anon_burst": "6/min",
        "user_burst": "60/min",
    },
}
```

### 2.3 Analysis Views Access Policy

**File**: `backend/analysis/views.py`

- Add `permission_classes = [AllowAny]` to:
  - `BlastTaskView`
  - `MsaTaskView`
  - `PeptideCalcView`
  - `SequenceAnalysisView`
  - `PrimerDesignView`
  - `AntibodyAnnotationView`
  - `AnalysisTaskViewSet`
- Add `throttle_classes = [AnonBurstRateThrottle, AuthenticatedRateThrottle]` to all above views.
- Keep global default permission unchanged.

### 2.4 Analysis Task Endpoint Hardening

`AnalysisTaskViewSet` must not expose open list access.

Implementation requirement:

- Keep detail polling endpoint: `GET /api/analysis/tasks/<uuid>/`
- Disable/forbid list endpoint: `GET /api/analysis/tasks/`

Recommended implementation:

```python
class AnalysisTaskViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    throttle_classes = [AnonBurstRateThrottle, AuthenticatedRateThrottle]
    queryset = AnalysisTask.objects.all()
    serializer_class = AnalysisTaskSerializer
    lookup_field = "id"
    http_method_names = ["get", "head", "options"]

    def list(self, request, *args, **kwargs):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
```

### 2.5 Backend Error Contract

For throttled requests:

- Status: `429`
- Header: `Retry-After: <seconds>`
- Body: DRF-compatible `detail` string

For protected resource without auth:

- Status: `401`
- Body: DRF-compatible `detail` string

## 3. Frontend Specification (Vite + React + TS)

### 3.0 Frontend Routing Baseline (Critical Fix)

To prevent tool-page URL mismatch and navigation instability, routing must use a **single route tree** and standard nested routing.

Requirements:

1. Do not nest `<Routes>` inside route `element` trees.
2. Use a layout route + `<Outlet />` for shared shell rendering.
3. Keep a single catch-all redirect at the top level.

Reference implementation (conceptual):

```tsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route element={<LayoutShell />}>
    <Route path="/" element={<Dashboard />} />
    <Route path="/projects" element={<ProjectsList />} />
    <Route path="/sequence-analysis" element={<SequenceAnalysis />} />
    <Route path="/peptide-calc" element={<PeptideCalculator />} />
    <Route path="/blast" element={<Blast />} />
    <Route path="/msa" element={<MSA />} />
    <Route path="/primer-design" element={<PrimerDesign />} />
    <Route path="/antibody-annotation" element={<AntibodyAnnotation />} />
  </Route>
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

### 3.1 API Client Responsibilities

**File**: `frontend/src/api/client.ts`

Must provide:

1. Unified token injection.
2. Correct refresh endpoint: `${API_BASE_URL}/auth/token/refresh/`.
3. Public/protected path discrimination by normalized pathname.
4. Standardized `ApiErrorInfo` transformation.

Public path guard:

```typescript
const PUBLIC_API_PREFIXES = ["/analysis/", "/auth/", "/health/"];

function normalizePath(url: string | undefined, baseURL: string): string {
  if (!url) return "";
  try {
    return new URL(url, baseURL).pathname;
  } catch {
    return url;
  }
}

function isPublicPath(url: string | undefined): boolean {
  const path = normalizePath(url, window.location.origin);
  return PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix));
}
```

### 3.2 Error Normalization Contract

```typescript
export interface ApiErrorInfo {
  message: string;
  status?: number;
  isRateLimited: boolean;
  retryAfter?: number;
}
```

Rules:

- Do not mutate raw Axios error object with custom fields.
- Convert to `ApiErrorInfo` in one utility.
- `retryAfter` comes from `Retry-After` header when status is `429`.

### 3.3 Response Interceptor Behavior

Decision order:

1. If status `429`: reject and let UI consume normalized error.
2. If status `401` and endpoint is public: reject directly, no redirect.
3. If status `401` and endpoint is protected:
   - attempt refresh once;
   - on refresh failure, clear tokens and redirect to `/login`.
4. Otherwise reject as regular API error.

### 3.4 Shared Analysis Hook

**File**: `frontend/src/hooks/useAnalysisTool.ts` (NEW)

Responsibilities:

- Encapsulate submit lifecycle (`loading`, `errorInfo`, `data`).
- Use shared `apiClient` and `handleApiError`.
- Provide `resetError` / retry-ready callback.
- Optional polling helper for task-based tools (BLAST/MSA).

### 3.5 Shared Rate Limit Component

**File**: `frontend/src/components/RateLimitAlert.tsx` (NEW)

Required behavior:

- Accept `retryAfter`, `message`, `onRetryReady`.
- Show second-level countdown.
- Trigger `onRetryReady` when countdown reaches zero.
- Provide clear copy for login-upgrade hint.

### 3.6 Tool Page Migration Scope

Migrate all pages to shared API flow:

- `Blast.tsx`
- `MSA.tsx`
- `PeptideCalculator.tsx`
- `SequenceAnalysis.tsx`
- `PrimerDesign.tsx`
- `AntibodyAnnotation.tsx`

Acceptance condition: no direct `axios` import remains in analysis pages.

## 4. Test Specification

### 4.1 Backend Tests

Must validate:

1. Anonymous access allowed for all analysis submit endpoints.
2. Anonymous throttling triggers at configured threshold.
3. `Retry-After` exists on 429 responses.
4. Authenticated requests follow higher throttle bucket.
5. `/api/analysis/tasks/` list is not publicly enumerable.
6. `/api/core/*` and `/api/projects/*` still require authentication.

### 4.2 Frontend Tests (Manual + Integration)

Must validate:

1. Anonymous user can run each analysis page without login redirect.
2. Rate-limit UI appears with countdown on 429.
3. Retry becomes available after countdown.
4. Protected pages (e.g. `/projects`) still require login.
5. Token refresh flow uses `/auth/token/refresh/`.
6. 401 on public endpoint does not trigger redirect loop.

## 5. Operational and Deployment Notes

### 5.1 Cache Backend

DRF throttle depends on Django cache backend:

- Development/single node: `LocMemCache` acceptable.
- Production/multi-node: shared Redis cache required for consistent limits.

### 5.2 Release Constraints

- No DB migration.
- No new env var required for v2.7 baseline.
- Existing JWT and routing contracts remain intact.

## 6. Release Gate (Must Pass)

1. Backend permission/throttle tests pass.
2. Frontend anonymous + 429 + protected-route scenarios pass.
3. Task enumeration risk is closed (`/api/analysis/tasks/` not openly listable).
4. Updated docs and checklist match final implementation behavior.
