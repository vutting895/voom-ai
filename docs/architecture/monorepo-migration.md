# VOOM AI Monorepo Migration Plan

Status: DRAFT — migration scaffold only
Target: vutting895/voom-ai / main
Source repositories:
- vutting895/voom-ai-f480ij (AI Workspace)
- vutting895/Voom-ai-sniper (AI Sniper)

## Target layout

apps/web/ — existing responsive client
apps/android/ — existing Android client
apps/workspace/ — AI chat, agent runtime, memory and document RAG
apps/sniper/ — market analysis, signals, risk and backtesting UI
packages/shared-contracts/ — versioned API schemas and shared DTOs
packages/auth/ — shared auth integration; server-side secrets only
packages/ai-runtime/ — provider adapters and safe AI orchestration
packages/market-data/ — provenance-aware market data contracts
packages/risk-engine/ — deterministic risk checks; no broker execution
services/api-gateway/ — authenticated, versioned boundary to NOVA Core

the existing Android and web clients remain in place. Workspace and Sniper are separate applications within the monorepo; they must not be flattened into one runtime or share privileged credentials.

## Import order

1. Establish repository-local contracts and safety gates (this PR).
2. Import Workspace frontend/backend source into apps/workspace after secret, SSRF, tenant-isolation and dependency review.
3. Import Sniper analysis/UI source into apps/sniper from reviewed source commits, not by blindly copying the current default branch.
4. Adapt both apps to root workspace tooling and shared versioned contracts.
5. Run local install, lint/typecheck, unit tests, build and security scans.
6. Open a separate integration PR for each completed import. Keep all PRs unmerged pending explicit approval.

## Workspace source assessment

Source main: 1a5df0780fe7899f99155a953e79906efef16de6. Candidate source includes voom-ai.html, server.js, sever.js, Supabase schema and documentation.

Do not import env.env. It contains credential-bearing environment entries and must be treated as exposed because it is committed to Git. Rotate every credential represented there before any future production use. Never copy values into this repository, logs, issues or PRs.

server.js and sever.js are separate implementations, not safe duplicates to merge automatically. Perform a route-by-route diff and select one canonical backend only after reviewing feature coverage. The custom endpoint feature requires SSRF controls: scheme/host allowlist, private/link-local IP rejection, redirect validation, DNS rebinding defense, timeout and response-size limits. Memory and document operations require authenticated tenant scoping and database RLS.

## Sniper source assessment

Source main: 22b5b4c5b45e06c17dc41a9139c77adfd17d78f4. Existing draft PR #2 (research/mt5-backtesting-integration) contains relevant safety changes and package metadata correction. Review/adapt its changes; do not duplicate its CI or blindly merge the old-repository PR.

The main-branch package manifest is invalid JSON (duplicate scripts key and missing separator). The reviewed PR #2 version is a candidate, not yet accepted.

The main branch contains executable broker paths, including a Bitkub order route and an MT5 worker calling mt5.order_send(). These files are excluded from import. No execution worker, broker write route, credentials, or order adapter may enter the monorepo. Replace execution interfaces with explicit disabled responses and read-only analysis contracts.

The broker-auth route on main uses a fixed user ID and a hard-coded fallback encryption key. It is excluded; do not port it. Broker authentication remains disabled until per-user authorization, tenant isolation, managed key rotation and audited secret storage are independently reviewed.

## Safety invariants

- Live trading remains OFF.
- No order submission, broker write, deposit, withdrawal or transfer endpoint.
- No executable MT5 worker or Bitkub order adapter in imported applications.
- Analysis and paper simulation are distinct from broker-verified activity.
- Trading scope is intraday only; no strategy or service may intentionally carry positions overnight.
- NOVA Core remains the authoritative analysis/risk governance boundary through versioned APIs.
- User access tokens are validated server-side; tenant identity is never accepted from an untrusted request body.
- No Supabase service-role key, broker secret, model key or other privileged secret in client code or Git.
- No deployment, production configuration change, CI/CD activation, billing change or merge is authorized by this migration plan.

## Acceptance gates

A source-import PR is not ready for approval until:
- Secret scan passes and all exposed source credentials are rotated.
- Dependency manifests and lockfiles are valid and reproducible.
- Workspace SSRF tests and tenant-isolation/RLS tests pass.
- Sniper execution routes return disabled responses and no imported source can invoke broker order APIs.
- Typecheck, lint, unit tests and production build pass locally.
- API contracts are versioned and do not bypass NOVA authentication/risk policy.
- Read-only / LIVE TRADING OFF labels are present in UI and API behavior.
- Reviewer confirms no overnight holding behavior is introduced.

## Current PR scope

This PR adds migration documentation and empty application boundaries only. It does not import source code, change runtime behavior, merge any source-repository PR, deploy, or enable live trading. Source import and remediation are subsequent, separately reviewable changes.
