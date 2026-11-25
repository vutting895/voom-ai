# Source Import Blockers

Status: OPEN — do not import affected source until remediated.

## Workspace — voom-ai-f480ij

| Finding | Evidence | Required disposition |
|---|---|---|
| Committed environment file | env.env includes Gemini, Supabase service and LINE credential variables | Never copy the file; rotate all represented credentials; add secret scanning and safe .env.example |
| SSRF exposure | server.js accepts caller-provided customEndpoint and fetches it | Remove arbitrary URL fetch or enforce strict outbound allowlisting and network-level private-IP blocking |
| Tenant isolation unproven | Memory/document queries use broad table reads and operations by record ID | Require authenticated user context, tenant predicates and RLS; add cross-tenant negative tests |
| Duplicate backend candidates | server.js and sever.js differ materially | Compare routes/features and select one canonical implementation; do not rename blindly |
| Security telemetry may be synthetic | Initial security log entries are hard-coded demo examples | Label fixtures as demo-only and never report them as observed attacks |

## Sniper — Voom-ai-sniper

| Finding | Evidence | Required disposition |
|---|---|---|
| Executable MT5 order path | mt5_execution_worker.py calls mt5.order_send() | Exclude from import; replace with read-only bridge contract; execution remains disabled |
| Bitkub order route | main app/api/trade/route.ts invokes createBitkubOrder() | Exclude order adapter; API must fail closed with HTTP 503 |
| Insecure broker identity | root route.ts uses default-user-id | Exclude route; implement verified Supabase subject and tenant scoping before broker connection |
| Hard-coded encryption fallback | root route.ts defines a default encryption key | Exclude route; no default key; managed secret rotation required |
| Invalid package manifest | main package.json has duplicate scripts and malformed JSON | Use reviewed candidate manifest from draft PR #2 only after lockfile/build verification |
| Incomplete proof of execution isolation | Analysis modules and order adapters coexist | Add static scan and route tests proving no broker write path is reachable |

## Required verification

- Run a repository history secret scan, not just a working-tree scan.
- Rotate exposed credentials before considering the old Workspace repo safe.
- Add tests for disabled trade endpoints (expected 503, no side effects).
- Search imported source for order_send, createBitkubOrder, broker write methods and direct broker credentials.
- Verify all market data is labeled by source, timestamp and verification state.
- Confirm no strategy or position manager intentionally holds trades across the broker-day boundary.

A finding is not resolved merely because documentation describes a mitigation. Resolution requires code changes and test evidence in the relevant source-import PR.
