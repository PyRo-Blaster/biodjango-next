# Changelog

All notable changes to this project will be documented in this file.

## [V2.7] - 2026-03-15

### Added

- Added public access policy for analysis endpoints with explicit per-view `AllowAny`.
- Added throttle classes for anonymous/authenticated request buckets in analysis module.
- Added reusable frontend rate-limit alert component with retry countdown behavior.
- Added shared analysis request hook for consistent submit/loading/error flow.
- Added V2.7 documentation bundle:
  - `docs/spec_v2.7.md`
  - `docs/iteration_plan_v2.7.md`
  - `docs/checklist_v2.7.md`
  - `docs/beta_test_guide_v2.7.md`
  - `docs/project_beta_test_plan_v2.7.md`
  - `docs/debug_plan_v2.7.md`
  - `docs/debug_plan_v2.7_routing_fix.md`
  - `docs/debug_plan_blast_msa_500_v2.7.md`
  - `docs/debug_log_v2.7.md`
  - `docs/release_notes_v2.7.md`

### Changed

- Refactored frontend route structure to a single nested route tree (`Layout + Outlet`).
- Updated API client and analysis pages to use unified error handling and public endpoint behavior.
- Updated deployment and README docs to include beta and v2.7 guidance.

### Fixed

- Fixed tool-page route mismatch/chain misrouting across BLAST, MSA, Peptide, Sequence Analysis, Primer, Antibody pages.
- Fixed BLAST/MSA enqueue failure handling: queue/broker exceptions now return `503` with actionable message instead of generic `500`.
- Fixed robustness of anonymous analysis flow while preserving protected project/core access boundaries.

### Security

- Enforced non-enumerable analysis task list endpoint behavior.
- Preserved authentication requirement for project/core modules while enabling tool-level anonymous access.

## [v2.5.0] - previous release

- Historical baseline tag present in repository before V2.7.
