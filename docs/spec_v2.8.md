# Spec: BioDjango v2.8.0 — API Permissions and Frontend Request Layer

## Overview

v2.8 is an internal-quality release that does **not** add user-facing features.
It corrects three classes of defects identified during the v2.7 retrospective:

1. **Permission model is too restrictive for departmental use.** Project
   creation and management require `is_staff`, so non-admin members cannot
   own a project, and the `owner` field on `Project` is effectively unused.
2. **Analysis endpoints are open to anonymous callers** by design from v2.7.
   For an internal tool used by ~30 colleagues this is the wrong default and
   it forces the throttle scopes to be very tight, which in turn breaks the
   task-status polling loops in the UI.
3. **The frontend has three competing request strategies.** Two of them
   produce broken URLs (`/api/api/...`) or call non-existent endpoints
   (`/api/auth/login/`, `/api/auth/logout/`). The raw-axios call sites
   bypass the JWT refresh interceptor and are subject to a startup race on
   `axios.defaults.headers.common.Authorization`.

Docker / deploy improvements remain on the roadmap but are deferred to v2.9
so this iteration can land without disturbing the build pipeline.

## Goals

- Any authenticated user can create a project; the creator becomes its owner
  and can manage it without admin intervention.
- Project owners (in addition to staff) can review access requests for
  projects they own.
- All analysis endpoints require authentication. Throttle scopes are
  re-tuned for an internal user base and a dedicated polling scope is
  introduced for `tasks/<id>/` GETs.
- Frontend requests go through a single `apiClient` axios instance with a
  consistent base URL, automatic JWT refresh, and a single source of truth
  for the `Authorization` header.
- URL paths between the frontend and backend match without the
  `/api/api/...` doubling and without the `/api/projects/projects/`
  doubling.

## Non-Goals

- No data model changes other than additive serializer fields.
- No change to the JWT signing scheme or the user model.
- No changes to BLAST/MSA/primer/antibody algorithms.
- No Docker, nginx, or CI changes.

## Target Permission Matrix

| Resource / Action | Anonymous | Authenticated user | Project owner | Staff |
|-------------------|-----------|--------------------|---------------|-------|
| `POST /api/projects/` (create) | No | Yes | n/a | Yes |
| `GET /api/projects/` (list metadata) | No | Yes | Yes | Yes |
| `GET /api/projects/{id}/` (detail) | No | Yes if allowed/public | Yes | Yes |
| `PATCH /api/projects/{id}/` | No | No | Yes | Yes |
| `DELETE /api/projects/{id}/` | No | No | Yes | Yes |
| `POST /api/projects/{id}/upload_fasta/` | No | No | Yes | Yes |
| `GET /api/projects/sequences/?project_id=` | No | Yes if allowed/public | Yes | Yes |
| `POST /api/projects/access-requests/` | No | Yes | Yes | Yes |
| `PATCH /api/projects/access-requests/{id}/review/` | No | No | Yes (own project) | Yes |
| `POST /api/analysis/*` | No | Yes (throttled) | Yes | Yes |
| `GET /api/analysis/tasks/{id}/` | No | Yes (poll scope) | Yes | Yes |
| `POST /api/auth/token/`, `/api/auth/token/refresh/`, `/api/auth/register/` | Yes | Yes | Yes | Yes |

## Throttle Scopes (Post-v2.8)

| Scope | Rate | Applies to |
|-------|------|------------|
| `user_burst` | `120/min` | Default authenticated rate, non-polling |
| `task_poll` | `600/min` | `AnalysisTaskViewSet.retrieve` only |
| `anon_burst` | (removed) | No anonymous endpoints remain |

## Frontend Request Contract

- A single `apiClient` (axios instance) with `baseURL = import.meta.env.VITE_API_URL || '/api'`.
- All call sites use **relative** paths that do **not** start with `/api/`
  (the base URL already supplies it). Example: `apiClient.get('/projects/')`,
  not `apiClient.get('/api/projects/')`.
- `apiClient` request interceptor injects `Authorization: Bearer <access>`
  from `localStorage` on every request.
- `apiClient` response interceptor handles 401 with refresh-and-retry, and
  surfaces 429 with `Retry-After` to the toast layer.
- `AuthContext` no longer mutates `axios.defaults`. Login/logout only
  read/write `localStorage` and React state.
- Every page that previously imported raw `axios` is migrated to
  `apiClient` (or to a typed module under `src/api/`).
- `src/api/auth.ts` exposes `login`, `register`, `refresh`. There is **no**
  `logout` HTTP call; logout is purely client-side until v2.9 introduces a
  refresh-token blacklist endpoint.

## URL Layout (Post-v2.8)

| Old path (v2.7) | New path (v2.8) | Notes |
|-----------------|-----------------|-------|
| `/api/projects/projects/` | `/api/projects/` | Drop the doubled prefix |
| `/api/projects/sequences/` | `/api/projects/sequences/` | Unchanged |
| `/api/projects/access-requests/` | `/api/projects/access-requests/` | Unchanged |
| `/api/core/projects/` | `/api/core/projects/` | Unchanged (legacy app) |
| `/api/analysis/tasks/{id}/` | `/api/analysis/tasks/{id}/` | Unchanged |

The doubling fix is a breaking change for any external script using the v2.7
URLs. Consumers in this repo are the only known callers.

## Acceptance Criteria

1. A non-staff user can log in, create a project, upload FASTA to it,
   delete one of their own sequences, and delete the project, without any
   admin involvement.
2. A non-owner cannot mutate a project they do not own (403, not 404).
3. An access request can be approved by either the project owner or a
   staff user. A non-owner non-staff user receives 403.
4. Anonymous calls to `/api/analysis/blast/` return 401, not 202.
5. The Blast and MSA pages can poll `/api/analysis/tasks/{id}/` once per
   second for at least 60 seconds without being throttled.
6. `grep -R "axios\." frontend/src` returns matches only inside
   `src/api/client.ts`. All other call sites use `apiClient`.
7. `grep -R "/api/api/" frontend/src` returns no matches.
8. Backend test suite passes including new permission and throttle tests.
