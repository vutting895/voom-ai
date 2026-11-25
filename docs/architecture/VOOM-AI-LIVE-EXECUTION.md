# VOOM AI Fully Automated Execution Architecture

**Status:** ARCHITECTURE BASELINE — implementation and production authorization pending  
**Decision:** A — Fully Automated Execution  
**Repository:** `vutting895/voom-ai`  
**Trading policy:** Intraday only; no intentional overnight positions  
**Current operating mode:** PAPER DESIGN / LIVE DISABLED

## 1. Scope and non-goals

This document defines the target architecture for a fully automated trading execution capability. "Fully automated" means that, after a separately authorized system activation, eligible signals may pass deterministic controls and be submitted without per-order human confirmation. It does **not** mean that an AI model can bypass policy, risk, authorization, or broker-state verification.

This change authorizes architecture and paper-mode contract work only. It does not authorize broker connectivity, broker credentials, Demo or Live order submission, production configuration changes, deployment, or merge to `main`.

Non-goals for this phase:
- No live broker adapter or callable broker-write method.
- No `mt5.order_send`, Bitkub order route, deposit, withdrawal, or transfer.
- No user-supplied execution flags or client-side authority.
- No model-generated direct broker commands.
- No overnight strategy or position carry.

## 2. Service ownership and trust boundaries

| Component | Responsibility | Must not do |
|---|---|---|
| Workspace | User interface, operational visibility, activation requests | Hold broker secrets or submit orders |
| Sniper | Market analysis, strategy evaluation, signal proposal | Call broker write APIs |
| NOVA Core | Identity, tenant authorization, policy registry, audit governance | Trust model/client assertions |
| Risk Engine (`services/risk_engine`) | Deterministic pre-trade risk decisions and daily lock reasons | Modify its own policy from model output or dispatch orders |
| Execution Service | Order lifecycle, idempotency, dispatch orchestration, position tracking | Bypass Risk Engine or Authorization |
| Broker Adapter | Future protocol translation and broker-state retrieval | Be reachable from Workspace/Sniper |
| Reconciliation | Compare internal state with broker-confirmed orders/deals/positions | Infer fills from submit acknowledgements |

Execution Service is the only future component permitted to dispatch broker orders. In this phase, its adapter boundary is specified but no broker-write implementation is permitted.

## 3. Fully automated decision pipeline

1. Market data arrives with source, symbol, timeframe, event timestamp, receive timestamp and verification state.
2. Sniper emits a typed signal proposal with strategy/model versions, direction, entry conditions, invalidation, stop-loss, take-profit and expiry.
3. Signal validation rejects stale, malformed, duplicate or unverifiable proposals.
4. Risk Engine computes size and checks trade risk, aggregate exposure, daily limits, spread and entry deviation. Account-specific margin, currency conversion, fees and broker contract metadata remain future integration requirements.
5. NOVA Core authorizes the service identity, tenant, account binding, policy version and current operating mode.
6. Execution Service creates an immutable intent and idempotency key. In the current phase it can only be recorded/simulated in PAPER mode.
7. A future authorized adapter may submit only after the production activation gate has been approved independently.
8. Broker acknowledgements, fills, rejects and position snapshots are reconciled. A submit acknowledgement is not a fill.
9. Position Manager applies protective and exit rules, and the Daily Controller enforces the broker-day cutoff.
10. Journal records every decision, state transition, broker event and operator action.

No stage may be skipped. A failure or unknown state fails closed for new entries.

## 4. Order and position state machines

### Order states

`RECEIVED → VALIDATING → RISK_CHECKED → AUTHORIZED → PREPARED → SUBMITTED → ACKNOWLEDGED → PARTIALLY_FILLED / FILLED`

Terminal or exception states: `REJECTED`, `CANCEL_PENDING`, `CANCELLED`, `EXPIRED`, `UNKNOWN_REQUIRES_RECONCILIATION`.

Rules:
- `SUBMITTED` means a dispatch attempt occurred; it does not mean accepted or filled.
- A timeout after dispatch moves to `UNKNOWN_REQUIRES_RECONCILIATION`; never blindly retry.
- Partial fills create/adjust the corresponding position quantity and retain the unfilled remainder state.
- Every transition records actor, timestamp, correlation ID, prior state, new state and reason.
- Invalid transitions are rejected and audited.

### Position states

`FLAT → OPENING → OPEN → REDUCING → CLOSING → CLOSED`

Exception states include `PROTECTION_MISSING`, `BROKER_STATE_UNKNOWN` and `EMERGENCY_MANAGEMENT`. Any unprotected or unknown position blocks new entries until reconciled and safely managed.

## 5. Intraday-only controls

- Use broker/server trading-day and session calendar as the authority; persist timestamps in UTC and retain the broker timezone/calendar identifier.
- Define a configurable entry cutoff and a separate mandatory flatten deadline, both earlier than the broker's close and adjusted for holidays/early closes.
- Stop opening new positions at the entry cutoff.
- Begin controlled close-out before the flatten deadline; verify broker-confirmed flat state before the deadline.
- Do not treat a close request as proof of closure. Reconcile open positions and pending orders until confirmed.
- If the broker is unavailable near cutoff, raise a critical incident, preserve the outstanding close intent, and resume reconciliation immediately on recovery. Never claim the account is flat without broker evidence.
- Strategy eligibility must reject any proposal whose expected holding horizon crosses the configured broker-day boundary.

## 6. Risk policy hierarchy

All limits are versioned, server-side and immutable during an active trading session. Risk checks are deterministic and independent of AI confidence.

Mandatory controls:
- Per-trade risk and maximum position size.
- Aggregate open risk and gross/net exposure.
- Maximum concurrent positions/orders.
- Daily realized + unrealized loss calculation against broker-day starting equity.
- Daily profit lock (blocks new entries; does not silently liquidate positions).
- Spread, slippage, price deviation and stale quote thresholds.
- Margin/free-margin floor and account-currency normalization.
- Symbol allowlist, session allowlist and strategy allowlist.
- Stop-loss required before entry; reject if broker cannot confirm protective order semantics.
- Kill switch for new-entry dispatch and a distinct emergency close-management workflow.

The previously discussed values (Daily Loss 10%, aggregate open risk 9%, maximum 5 orders) are **legacy proposals only**, not approved production defaults. They must not be silently activated. Final thresholds require documented backtest, stress-test and Demo evidence plus separate owner approval.

A broker-independent deterministic Risk Engine has been added as a separate package. The Paper Execution Engine delegates pre-trade decisions to it. This is code-level separation for the Paper harness, not yet an independently deployed or authenticated risk service.

## 7. Authorization and operating modes

Modes are server-controlled:
- `DISABLED`: no dispatch; default.
- `PAPER`: simulated fills only; no broker write capability.
- `DEMO`: future broker Demo mode; separately gated and not enabled by this PR.
- `LIVE`: future real-money mode; prohibited until a separate production authorization.

For every non-disabled mode, NOVA must verify tenant, authenticated principal, service identity, account ownership, policy version, environment binding and explicit mode authorization. A client, strategy or model cannot set the effective mode.

Fully automated operation removes per-order confirmation only after system activation. Activation itself requires an explicit, auditable authorization with scope, account, environment, limits, expiry and revocation path.

## 8. Reliability, idempotency and reconciliation

- Generate a unique intent ID and idempotency key before any dispatch attempt.
- Enforce a database uniqueness constraint on the idempotency scope.
- Persist intent and outbox event transactionally before dispatch.
- Use at-least-once worker delivery with idempotent processing; do not claim exactly-once network delivery.
- On timeout, process crash or reconnect, query broker state using stable client/order identifiers before deciding whether a retry is safe.
- Reconcile internal orders, broker orders, deals, positions, balance and equity at startup, after reconnect, after every execution event and periodically.
- Detect orphan broker positions, missing internal orders, quantity/price mismatches and stale snapshots.
- Quarantine mismatches and block new entries until policy-defined recovery completes.

## 9. Security controls

- Broker credentials, if ever introduced, are stored only in a managed server-side secret store and scoped to a dedicated execution identity.
- No secrets in client apps, Git, test fixtures, logs, traces or exception messages.
- Tenant and account identity are derived from verified server-side authorization, never request-body claims.
- Enforce least privilege, request authentication, authorization per action, replay protection, rate limits and immutable audit records.
- Separate read-only broker data access from order-write capability.
- Broker-write permission must be absent from Paper deployments and from Workspace/Sniper identities.
- Static security checks must fail if forbidden broker-write symbols or adapters appear in this phase.

## 10. Failure policy

| Failure | Required behavior |
|---|---|
| Risk service unavailable | Reject/block new entries |
| NOVA authorization unavailable | Reject/block new entries |
| Stale market data | Reject signal |
| Broker/bridge disconnected | Block new entries; preserve reconciliation/exit work |
| Dispatch timeout | Unknown state; reconcile before retry |
| Duplicate intent | Return existing intent; no second dispatch |
| Missing stop/protection | Reject entry or enter emergency management if already exposed |
| Daily loss limit reached | Entry lock; manage existing positions under exit policy |
| Kill switch activated | Stop new entries; keep exit and reconciliation paths available |
| End-of-day close unconfirmed | Critical incident; do not report flat |

## 11. Observability and audit

Every signal, risk decision, authorization, order intent, dispatch attempt, broker response, fill, cancel, position update, lock and emergency action must include:
- UTC timestamp and broker event timestamp where available.
- Tenant/account reference (non-secret identifier).
- Correlation ID, intent ID, idempotency key and broker ticket/deal ID.
- Strategy/model/version and policy version.
- Requested and confirmed quantity/price, fees, slippage and currency.
- Decision outcome and machine-readable reason code.

Dashboards must distinguish `PROPOSED`, `PAPER_SIMULATED`, `BROKER_ACKNOWLEDGED` and `BROKER_CONFIRMED_FILL`. Never display simulated results as real account activity.

## 12. Delivery phases and exit criteria

1. **Architecture/contracts:** approved service boundaries, state machines, API contract and safety invariants.
2. **Paper engine:** deterministic simulator, event journal, idempotency and failure-injection tests; no broker-write code. A first in-memory Paper harness and separate deterministic risk package exist on stacked draft PRs; tests are authored but not yet executed.
3. **Demo adapter:** separate work order and approval; controlled Demo credentials, account binding and broker-state reconciliation.
4. **Reliability/security:** disconnect, timeout, partial fill, duplicate, restart, daily cutoff, emergency management and tenant-isolation tests.
5. **Production readiness:** evidence review, risk thresholds approval, operational runbooks, monitoring and independent authorization.
6. **Live activation:** separate explicit approval; not implied by this architecture or by successful tests.

## 13. Current safety declaration

`ordersEnabled=false`, `executionEnabled=false`, `liveTradingEnabled=false`. No live broker connectivity, credentials, order submission, deployment or main-branch merge is authorized by this document. Paper-mode implementation must preserve these invariants and must not contain a latent live-write path.
