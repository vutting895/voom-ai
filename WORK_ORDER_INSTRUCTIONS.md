# VOOM AI Repository Work Instructions

**Repository:** `vutting895/voom-ai`  
**Default branch:** `main`  
**Central policy registry:** https://github.com/vutting895/voom-shared-contracts  
**Reporting policy:** `REPORTING-SCOPE-001`  
**Applicable rollout work order:** `WO-2026-11-24-002`

## Mandatory pre-work sequence

Before each task:
1. Read this file, the repository README, and the canonical reporting policy.
2. Read the applicable approved central Work Order and verify its current state, phase, scope, dependencies, and stop conditions.
3. Inspect the current `refs/heads/main` SHA, active pull requests, relevant source, tests, and local evidence before changing files.
4. Compare the request with existing work to avoid duplicate tasks or conflicting implementations.
5. Keep implementation changes on reviewed feature branches and submit pull requests to `main`, consistent with this repository's development policy. Do not deploy or release without separate approval.
6. Record meaningful operations and exact evidence; do not claim tests passed unless they were executed.

## VOOM AI ownership and safety boundaries

- VOOM AI owns the Android and responsive web client application layer.
- NOVA Core remains the analysis/system backend and owns authentication/session governance, central orchestration, and trading risk/safety controls.
- Datacenter owns research and learning computation and authoritative research lineage.
- Integrate through versioned APIs and approved shared contracts; do not duplicate NOVA or Datacenter authoritative logic.
- Preserve Supabase Auth user-token handling. Never expose service-role keys or other privileged credentials in client code.
- Client-supplied market data must not be represented as broker-verified data.
- Paper Simulation must remain clearly distinct from live account activity.
- Live trading remains OFF. No order submission, broker writes, deposits, withdrawals, or account mutation.
- Maintain zero-cost strict; no paid service or billing activation without explicit approval.
- No Base44 runtime.
- Build, signing, installation, deployment, and production release require separate approval.

## Reporting scope — REPORTING-SCOPE-001

- Canonical policy: https://github.com/vutting895/voom-shared-contracts/blob/main/standards/REPORTING-SCOPE-POLICY.md
- Rollout work order: `WO-2026-11-24-002`.
- When a report is requested from the VOOM AI Project/repository context, report only VOOM AI's own client implementation, assigned tasks, phases, status, blockers, logs, evidence, and next actions.
- External repositories may be identified as dependencies, but their internal work and progress must not be merged into a VOOM AI-local report.
- Cross-repository reporting is reserved for the central Ecosystem Governance / Master Coordination context and only for repositories with recorded active or planned work. Keep each repository's status and evidence separate.
- GitHub account membership alone does not establish ecosystem membership. Excluded, separate, legacy, and unclassified repositories must not be included unless explicitly registered and approved.

## Evidence and status

For every meaningful task, record UTC timestamp, Work Order ID, repository, branch, before/after SHA, changed paths, checks and exact results, evidence links, blockers, and next action. Distinguish authored tests from executed tests. Mark missing runtime or test proof as UNVERIFIED. Documentation presence alone does not prove implementation or integration.

## Stop conditions

Stop when scope/ownership is unclear, approval is missing or stale, a required dependency is unavailable, tests fail, or a security/cost/permission/production decision is required. Do not infer approval for deployment, live trading, order execution, or paid services.
