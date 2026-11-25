# VOOM Sniper — Analysis Boundary

This application owns market-data analysis, strategy evaluation, signal screening,
backtesting, and clearly labelled paper simulation only.

## Trading constraints

- Intraday strategy only: positions must be closed before the broker's trading-day
  boundary; no overnight holding is permitted.
- No broker login, account linking, order submission, cancellation, modification,
  deposit, withdrawal, or transfer is implemented in this application.
- The trade API intentionally returns HTTP 503 with
  `SNIPER_EXECUTION_DISABLED`.
- The legacy MT5 worker is a no-side-effect compatibility stub. It does not import
  the MT5 package or establish a broker session.
- Analysis signals and paper-simulation records must never be represented as
  broker-confirmed orders or fills.

Execution requires a separately approved service, authenticated tenant boundary,
server-side risk governance, idempotency, audit trail, and explicit production
release authorization. This repository boundary does not grant that authorization.
