# Execution Acceptance Matrix

**Status:** Required test plan; results not yet run.  
**Current permitted scope:** static checks and Paper-only simulation.

| ID | Scenario | Expected result | Evidence required |
|---|---|---|---|
| EX-001 | Default service startup | Mode is DISABLED; all execution safety flags false | Config/unit test |
| EX-002 | PAPER mode request | Accepted only in isolated Paper environment | Environment-policy test |
| EX-003 | DEMO or LIVE mode request in this phase | Rejected with MODE_NOT_ALLOWED | API test; no side effects |
| EX-004 | Missing/expired signal | Rejected before risk evaluation | Unit/API test |
| EX-005 | Missing stop loss | Rejected | Risk test |
| EX-006 | Risk service unavailable | Fail closed; no intent dispatch | Fault-injection test |
| EX-007 | NOVA authorization unavailable | Fail closed; no intent dispatch | Fault-injection test |
| EX-008 | Daily loss limit reached | Entry lock; existing simulated position remains managed | Risk integration test |
| EX-009 | Daily profit target reached | Entry lock; no automatic claim of position closure | Risk integration test |
| EX-010 | Duplicate idempotency key, same payload | Return original intent; no duplicate simulation | Persistence concurrency test |
| EX-011 | Same key, different payload | Reject with IDEMPOTENCY_CONFLICT | API/persistence test |
| EX-012 | Worker crashes after durable intent | Resume from outbox without duplicate intent | Restart test |
| EX-013 | Partial fill simulation | Correct open quantity and remaining quantity | State-machine test |
| EX-014 | Invalid order-state transition | Reject and audit | State-machine test |
| EX-015 | Stale quote or excessive spread | Reject new entry | Risk test |
| EX-016 | Broker-write symbol scan | No MT5 order_send / Bitkub order adapter in this phase | Static scan |
| EX-017 | Client attempts to set tenant/account/mode | Ignore or reject; use server-derived identity | Auth/tenant test |
| EX-018 | Cross-tenant read/write attempt | Deny without leaking resource existence | Isolation test |
| EX-019 | Kill switch | New-entry path disabled; exit/reconciliation workflows remain available | Integration test |
| EX-020 | End-of-day close in Paper | Simulate close and verify flat state before reporting flat | Session test |
| EX-021 | Broker-day holiday/early close | Calendar-aware cutoff used | Calendar test |
| EX-022 | Unknown dispatch outcome | Reconciliation required before retry | Fault-injection test |
| EX-023 | Logs and traces | No credentials, tokens or raw secrets | Secret scan |
| EX-024 | Paper UI/report | Clearly distinguish PAPER_SIMULATED from broker-confirmed activity | UI/API contract test |

## Release gates

A Paper release candidate is not accepted until all applicable tests pass on the exact candidate commit. Demo tests are a separate phase and require separate approval. Live tests are not part of this work order.

No test plan or passing Paper suite alone authorizes deployment, production configuration changes, main merge or Live Trading.
