# Execution API Contract v1 — Paper-first

**Status:** Proposed contract; no production endpoint is implemented or enabled.  
**Default mode:** `DISABLED`; test mode: `PAPER` only.

## Contract invariants

- API contracts validate shape; they do not grant authority.
- Effective tenant, principal and account scope are resolved server-side.
- Client-provided `userId`, `tenantId`, `accountId`, `executionMode` and safety flags are untrusted.
- This phase has no broker-write endpoint and no broker-write credential.
- All mutations are authenticated, authorized, idempotent where applicable, rate-limited and audited.
- Responses distinguish proposal, simulation, broker acknowledgement and broker-confirmed fill.

## Proposed resources

| Method | Path | Purpose | Phase |
|---|---|---|---|
| POST | `/v1/signals` | Submit typed strategy proposal | Paper |
| POST | `/v1/risk/evaluations` | Evaluate proposal under active policy | Paper |
| POST | `/v1/order-intents` | Create immutable simulated intent | Paper |
| GET | `/v1/order-intents/{intentId}` | Read intent and lifecycle | Paper |
| GET | `/v1/orders` | Read simulated orders | Paper |
| GET | `/v1/positions` | Read simulated positions | Paper |
| POST | `/v1/positions/{positionId}/close-intents` | Simulate close request | Paper |
| POST | `/v1/control/entry-lock` | Lock/unlock entries subject to authorization | Paper |
| POST | `/v1/control/kill-switch` | Disable new-entry dispatch | Paper |
| GET | `/v1/daily-summary` | Read broker-day simulation summary | Paper |

No `/submit-live`, broker order, account mutation, deposit, withdrawal or transfer route is defined in v1. A future Demo/Live dispatch contract requires a separately reviewed version and approval.

## Signal proposal

Required fields:
- `signalId`: UUID, globally unique within tenant scope.
- `strategyId`, `strategyVersion`, `modelVersion`.
- `symbol`, `side` (`BUY` or `SELL`), `timeframe`.
- `createdAt`, `expiresAt` (UTC RFC 3339).
- `entry`: price/condition reference and quote timestamp.
- `stopLoss`: mandatory price and rationale.
- `takeProfit`: one or more target prices or explicit managed-exit policy.
- `marketDataRef`: immutable source/provenance reference.
- `riskContextRef`: reference to the evaluation inputs.

Reject unknown symbols, unsupported side/timeframe, expired signals, invalid price relationships, missing stop loss, unverifiable market-data references and duplicate signal IDs.

## Risk evaluation response

The response includes:
- `evaluationId`, `signalId`, `policyVersion`, `evaluatedAt`.
- `decision`: `ALLOW_PAPER` or `REJECT`.
- `reasonCodes[]`: stable machine-readable codes.
- `requestedRisk`, `maxAllowedRisk`, `proposedQuantity`.
- `spread`, `slippageAssumption`, `marginEstimate`, `aggregateExposure`.
- `dailyPnl`, `dailyLossLimit`, `entryLock`.
- `expiresAt`: short-lived authorization/evaluation expiry.

A model score is advisory input only and cannot override a failed deterministic rule.

## Order intent

An order intent is immutable after creation except for append-only lifecycle events. It includes:
- `intentId`, `idempotencyKey`, `signalId`, `evaluationId`.
- `mode`: `PAPER` only in this phase.
- `symbol`, `side`, `quantity`, `orderType`, `limitPrice?`.
- `stopLoss`, `takeProfit`, `timeInForce`, `expiresAt`.
- `policyVersion`, `createdAt`, `correlationId`.

The API must reject a mode other than `PAPER` in this phase. It must not accept broker ticket IDs as client input.

## Error model

Use a stable envelope:
- `code`: machine-readable error code.
- `message`: safe operator-facing description.
- `correlationId`: support trace reference.
- `retryable`: boolean.
- `details`: allowlisted structured context only; never include credentials or raw provider secrets.

Required codes include `SIGNAL_EXPIRED`, `INVALID_SIGNAL`, `RISK_REJECTED`, `POLICY_UNAVAILABLE`, `UNAUTHORIZED`, `FORBIDDEN`, `DUPLICATE_INTENT`, `IDEMPOTENCY_CONFLICT`, `STALE_MARKET_DATA`, `ENTRY_LOCKED`, `MODE_NOT_ALLOWED` and `RECONCILIATION_REQUIRED`.

## Event envelope

All lifecycle events carry `eventId`, `eventType`, `occurredAt` (UTC), `aggregateId`, `aggregateVersion`, `correlationId`, `actorType`, `actorRef` and a schema-versioned `payload`.

Events are append-only. Consumers must tolerate duplicate delivery and out-of-order arrival by checking event identity and aggregate version.

## HTTP semantics

- `400`: malformed request.
- `401`: missing/invalid authentication.
- `403`: authenticated but not authorized.
- `409`: idempotency/state conflict.
- `422`: semantically invalid signal/intent or risk rejection.
- `423`: entry lock / disabled operating mode.
- `429`: rate limit.
- `503`: required policy, risk or authorization dependency unavailable.

Do not use HTTP 200 to represent a broker fill unless a broker-confirmed fill exists. Paper simulation responses must be explicitly labeled `PAPER_SIMULATED`.

## Security and audit requirements

- Validate JSON schema at the edge and service boundary.
- Enforce tenant scope in every query and mutation.
- Enforce idempotency uniqueness at persistence layer, not only in memory.
- Use transactional outbox for durable asynchronous processing.
- Record all accepted and rejected decisions.
- Redact credentials, tokens and sensitive account data from logs.
- Never expose a broker credential or order-write capability to a client.
