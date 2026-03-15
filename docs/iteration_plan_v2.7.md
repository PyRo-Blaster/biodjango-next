# Iteration Plan: BioDjango v2.7.0

## Overview

This iteration delivers **Public Access for Bioinformatics Tools** while preserving authentication for project/data management.  
The implementation is split into backend access control and frontend request-flow governance to eliminate login friction without weakening security boundaries.

## 1. Problem Statement

Reported pain points:

1. Bioinformatics tools are blocked by login requirements.
2. Public-tool calls return 401 and trigger incorrect login redirects.
3. Casual users face unnecessary onboarding friction.
4. Product expectation is "tools public, project management protected".

Confirmed root causes:

- Global DRF default permission is `IsAuthenticated`.
- Analysis views do not override permission and throttle policy.
- Frontend treats all 401 responses as protected-resource failures.
- Tool pages call `axios` directly, bypassing centralized API client behavior.

## 2. Scope and Non-Goals

### In Scope

- Open analysis endpoints to anonymous users with rate limiting.
- Keep core/projects endpoints protected.
- Add robust 429 UX and controlled 401 handling.
- Standardize frontend API consumption path for analysis tools.
- Add test coverage for permission, throttle, and UX-critical paths.

### Out of Scope

- No database schema migration.
- No auth model redesign.
- No feature redesign for project management modules.

## 3. Access and Security Baseline (Post-v2.7)

| Module | Endpoint | Anonymous | Authenticated | Notes |
|--------|----------|-----------|---------------|-------|
| Analysis | `/api/analysis/blast/` | Yes | Yes | Throttled |
| Analysis | `/api/analysis/msa/` | Yes | Yes | Throttled |
| Analysis | `/api/analysis/peptide-calc/` | Yes | Yes | Throttled |
| Analysis | `/api/analysis/sequence-analysis/` | Yes | Yes | Throttled |
| Analysis | `/api/analysis/primer-design/` | Yes | Yes | Throttled |
| Analysis | `/api/analysis/antibody-annotation/` | Yes | Yes | Throttled |
| Analysis | `/api/analysis/tasks/<uuid>/` | Yes | Yes | Throttled, retrieve-only |
| Analysis | `/api/analysis/tasks/` | No | No | List disabled to avoid enumeration |
| Core / Projects | `/api/core/*`, `/api/projects/*` | No | Yes | Existing policy retained |
| Auth | `/api/auth/*` | Public by design | Yes | Existing policy retained |

## 4. Delivery Phases

### Phase 1: Backend Access Control and Throttling (Critical)

1. Create custom throttles in `backend/analysis/throttles.py`.
2. Keep global `IsAuthenticated`; override `permission_classes = [AllowAny]` only on analysis views.
3. Apply throttles on all public analysis endpoints:
   - Anonymous: `anon_burst = 6/min`
   - Authenticated: `user_burst = 60/min`
4. Harden task query surface:
   - Keep task detail polling (`/tasks/<uuid>/`)
   - Disable open list endpoint (`/tasks/`) to prevent task enumeration.
5. Return consistent throttle response data (`detail`) and `Retry-After` header.

### Phase 2: Frontend Request Governance and UX (High)

1. Fix token refresh path to backend-compatible route (`/auth/token/refresh/`).
2. Add robust public-path detection based on normalized pathname (not substring matching).
3. Implement `ApiErrorInfo` structured error model (`message`, `status`, `isRateLimited`, `retryAfter`).
4. Build `RateLimitAlert` component with countdown and retry-ready callback.
5. Introduce `useAnalysisTool` hook to centralize submit/loading/error/rate-limit handling.
6. Migrate all analysis pages to shared hook + shared API client.
7. Refactor frontend routing to a single nested route tree (`Layout + Outlet`) and remove nested `Routes` inside route elements.
8. Verify one-to-one mapping for each tool URL and page component using browser MCP regression.

### Phase 3: Documentation, Testing, and Release Gate (High)

1. Update spec/checklist/doc examples with final endpoint and error contract.
2. Run backend tests for permission/throttle boundaries and protected-route regression.
3. Run frontend tests for anonymous flow, 429 UX, and protected-page auth behavior.
4. Publish beta runbook with deployment steps and tester-facing usage notes.
5. Require release gate sign-off before merge.

## 5. File Impact Plan

| File | Change | Priority | Phase |
|------|--------|----------|-------|
| `backend/analysis/throttles.py` | Create | Critical | 1 |
| `backend/analysis/views.py` | Modify | Critical | 1 |
| `backend/config/settings.py` | Modify | Critical | 1 |
| `backend/analysis/tests.py` | Modify | High | 1/3 |
| `frontend/src/api/client.ts` | Modify | Critical | 2 |
| `frontend/src/components/RateLimitAlert.tsx` | Create | High | 2 |
| `frontend/src/hooks/useAnalysisTool.ts` | Create | High | 2 |
| `frontend/src/pages/*.tsx` (analysis tools) | Modify | High | 2 |
| `frontend/src/App.tsx` | Modify | Critical | 2 |
| `docs/spec_v2.7.md` | Modify | High | 3 |
| `docs/checklist_v2.7.md` | Modify | High | 3 |
| `docs/beta_test_guide_v2.7.md` | Create | High | 3 |

## 6. Risks and Mitigations

1. **Task data exposure through open list endpoint**
   - Mitigation: Disable list; allow UUID detail polling only.
2. **Frontend logic inconsistency if pages bypass shared client**
   - Mitigation: Migrate all tool pages to hook + api client in same iteration.
3. **Throttle instability on non-shared cache**
   - Mitigation: Validate cache backend and document Redis recommendation for production.
4. **Auth regression on protected modules**
   - Mitigation: Add explicit regression tests for `/api/core/*` and `/api/projects/*`.
5. **Frontend route-to-page mismatch caused by non-standard route nesting**
   - Mitigation: Use single route tree with `Outlet`; add MCP route mapping regression in release gate.

## 7. Backward Compatibility

- No breaking API contract for existing authenticated clients.
- Existing project-management authorization remains unchanged.
- Anonymous access is additive and limited to analysis endpoints.
- No migration and no new environment variable required.

## 8. Release Success Criteria

1. Anonymous users can submit all analysis tools without login.
2. Anonymous requests are throttled at `6/min` with `Retry-After`.
3. Authenticated users can use analysis APIs with higher quota (`60/min`).
4. Public-endpoint 401 does not trigger forced login redirect.
5. Protected APIs still return auth-required behavior for anonymous users.
6. Frontend displays actionable 429 countdown message and allows retry when ready.
7. All release-gate checklist items pass.
8. Tool URLs and rendered pages are one-to-one consistent with no chain misrouting.

## 9. Version Info

- **Version**: 2.7.0
- **Codename**: Public Access Release
- **Target**: Reduce tool-entry friction while preserving project-data protection
- **Breaking Changes**: None
