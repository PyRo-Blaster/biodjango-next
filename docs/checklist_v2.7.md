# Development Checklist & Best Practices: BioDjango v2.7.0

## 1. Delivery Checklist

### Phase 1 - Backend (Blocking)

#### 1.1 Throttle Foundation
- [ ] Create `backend/analysis/throttles.py`
- [ ] Add `AnonBurstRateThrottle(scope="anon_burst")`
- [ ] Add `AuthenticatedRateThrottle(scope="user_burst")`
- [ ] Ensure rates are configured in `settings.py` (not hardcoded in class)

#### 1.2 DRF Settings
- [ ] Keep `DEFAULT_PERMISSION_CLASSES = IsAuthenticated`
- [ ] Add `DEFAULT_THROTTLE_RATES.anon_burst = 6/min`
- [ ] Add `DEFAULT_THROTTLE_RATES.user_burst = 60/min`
- [ ] Verify cache backend availability for throttle counters

#### 1.3 Analysis View Policy
- [ ] Add `permission_classes = [AllowAny]` for all analysis submit views
- [ ] Add throttle classes for all analysis submit views
- [ ] Add same policy for task detail polling endpoint
- [ ] Disable list endpoint `/api/analysis/tasks/` to prevent task enumeration
- [ ] Keep `/api/core/*` and `/api/projects/*` unchanged

#### 1.4 Backend Validation
- [ ] Anonymous BLAST submit returns accepted response
- [ ] Anonymous MSA submit returns accepted response
- [ ] Anonymous primer-design submit returns success response
- [ ] 429 appears after threshold for anonymous requests
- [ ] 429 includes `Retry-After` header
- [ ] Authenticated request uses higher quota
- [ ] `/api/analysis/tasks/` list is not publicly exposed
- [ ] Protected modules still require authentication

---

### Phase 2 - Frontend (Blocking)

#### 2.1 API Client Hardening
- [ ] Fix token refresh endpoint to `/auth/token/refresh/`
- [ ] Add normalized-path `isPublicPath()` implementation
- [ ] Keep 401 behavior split by public/protected endpoint
- [ ] Handle 429 and parse `Retry-After`
- [ ] Export normalized `ApiErrorInfo` structure
- [ ] Ensure no custom mutation of raw axios error object

#### 2.2 Shared UX Components
- [ ] Create `frontend/src/components/RateLimitAlert.tsx`
- [ ] Implement countdown timer from `retryAfter`
- [ ] Trigger `onRetryReady` when cooldown reaches zero
- [ ] Keep alert copy reusable across tool pages

#### 2.3 Shared Analysis Hook
- [ ] Create `frontend/src/hooks/useAnalysisTool.ts`
- [ ] Centralize loading/error submission state
- [ ] Integrate `handleApiError` for normalized error output
- [ ] Provide helper for clearing/retrying error state

#### 2.4 Tool Page Migration
- [ ] Migrate `Blast.tsx` to shared hook + shared api client
- [ ] Migrate `MSA.tsx` to shared hook + shared api client
- [ ] Migrate `PeptideCalculator.tsx` to shared hook + shared api client
- [ ] Migrate `SequenceAnalysis.tsx` to shared hook + shared api client
- [ ] Migrate `PrimerDesign.tsx` to shared hook + shared api client
- [ ] Migrate `AntibodyAnnotation.tsx` to shared hook + shared api client
- [ ] Confirm no direct `axios` usage remains in analysis pages

#### 2.5 Frontend Validation
- [ ] Anonymous users can run tools without login redirect
- [ ] Rate-limit alert is rendered on 429
- [ ] Countdown decrements correctly
- [ ] Request can be retried after countdown
- [ ] Authenticated users are not blocked under normal use
- [ ] Protected route (`/projects`) still requires authentication
- [ ] Route tree uses standard `Layout + Outlet` nesting (no nested `Routes` in route element)
- [ ] URL-to-page mapping is correct for all tool paths (`/blast`, `/msa`, `/peptide-calc`, `/sequence-analysis`, `/primer-design`, `/antibody-annotation`)
- [ ] MCP browser regression confirms no chain misrouting after route switch

---

### Phase 3 - Docs and Release Gate (Blocking)

- [ ] Sync `iteration_plan_v2.7.md` with final technical decisions
- [ ] Sync `spec_v2.7.md` with final endpoint/error contract
- [ ] Sync `checklist_v2.7.md` with actual implementation scope
- [ ] Add/update Beta deployment runbook (`docs/beta_test_guide_v2.7.md`)
- [ ] Add tool-specific tester tips and caution notes for all public tools
- [ ] Prepare issue feedback template for Beta users
- [ ] Run full backend + frontend smoke test in clean environment
- [ ] Validate Docker/local startup scenario if release path uses Docker
- [ ] Complete release gate sign-off before merge

## 2. Code Review Gate

PR cannot be merged unless all checks are true:

- [ ] Global permission default remains `IsAuthenticated`
- [ ] All intended analysis endpoints explicitly use `AllowAny`
- [ ] Throttles are applied consistently across analysis endpoints
- [ ] `/api/analysis/tasks/` list endpoint is not openly enumerable
- [ ] Frontend does not redirect on public endpoint 401
- [ ] Frontend refresh path is `/auth/token/refresh/`
- [ ] Frontend uses `ApiErrorInfo` contract consistently
- [ ] Analysis pages use shared client/hook pattern
- [ ] Frontend routing follows single route tree with stable nested layout

## 3. Best Practices

### 3.1 Permission Strategy

- Override permission per analysis view.
- Never relax global DRF defaults for convenience.

### 3.2 Throttle Strategy

- Anonymous and authenticated buckets both configured.
- Keep rates in settings for easy ops tuning.
- Validate behavior using shared cache in production.

### 3.3 Frontend API Strategy

- One request gateway (`apiClient`) for tool pages.
- One error model (`ApiErrorInfo`) for UI decisions.
- One hook (`useAnalysisTool`) for repeated submit logic.

### 3.4 Error Handling Strategy

- Never mutate original `AxiosError`.
- Always transform into plain typed error info.
- Always source retry timing from response headers.

## 4. Common Failure Patterns to Avoid

1. Opening analysis endpoints by changing global permission defaults.
2. Leaving direct `axios` calls in some pages after client refactor.
3. Using substring matching for public path checks (false positives).
4. Forgetting to update token refresh URL to backend route.
5. Exposing `/api/analysis/tasks/` list after enabling anonymous access.
6. Hardcoding retry countdown in UI instead of using `Retry-After`.
7. Nesting `Routes` inside route elements, causing route context mismatch and page misrouting.

## 5. Rollback Strategy

If production risk appears:

1. Revert analysis permissions to authenticated-only mode.
2. Increase/decrease throttle rates via settings depending on observed traffic.
3. Disable new frontend rate-limit UX while keeping backend protections active.
4. Confirm cache health before concluding throttle failure.
