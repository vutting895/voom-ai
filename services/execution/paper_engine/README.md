# Paper Execution Engine

This package is an isolated, deterministic simulator. It delegates deterministic entry decisions to `services/risk_engine`. Optional `SQLitePaperStore` persistence stores a JSON state snapshot and append-only event journal in one SQLite transaction, and restores positions, results, idempotency keys and daily lock state after process restart. It has no broker adapter, network client, credential loader, order-write API, or MT5/Bitkub integration. It is not a live execution service.

## Run tests

From the repository root:

```bash
python -m unittest discover -s services/risk_engine -p 'test_*.py' -v
python -m unittest discover -s services/execution/paper_engine -p 'test_*.py' -v
python -m unittest discover -s services/execution -p 'test_*.py' -v
```

## Behavior

- The engine only represents `PAPER` mode and simulates fills from caller-supplied quotes.
- Uses `Decimal` for prices, quantities and risk calculations.
- Requires UTC timestamps, fresh quotes, valid stop-loss/take-profit geometry, bounded spread and entry deviation.
- Enforces an explicitly configured UTC entry cutoff and flatten deadline; these are simulator inputs, not a broker holiday/session calendar.
- Applies per-trade risk, aggregate open risk, maximum open positions, daily loss and daily profit entry locks.
- Supports idempotency conflict detection and duplicate suppression; with SQLite storage enabled, accepted intent idempotency survives process restart.
- Persists position open/close, marks, rejects, daily locks and EOD flatten snapshots with corresponding append-only journal events.
- Requires a file-backed SQLite path; state snapshot and event append commit atomically. Storage write failure puts the engine into fail-stop state; recreate it from the last durable snapshot before accepting more PAPER work.
- Validates all required marks before an end-of-day close, preventing partial in-memory flattening due to missing or invalid marks.
- `services/execution/eod_controller.py` is a callable PAPER-only controller (not a scheduler): an external test harness must invoke it at/after the configured deadline. It rejects missing/stale/future/malformed quotes (and journals blocked attempts when SQLite persistence is enabled), closes BUY positions at Bid and SELL positions at Ask, and persists the entire simulated close as one snapshot/journal transaction.
- Simulates stop/target exits and explicit end-of-day flattening using supplied paper marks.
- Refuses day rollover while any paper position remains open.

## Limitations — not production ready

- SQLite persistence is local to one host/process deployment; it is not a shared multi-instance database and has no distributed lock, transactional outbox, broker reconciliation, encryption/key management, backup/restore automation or retention policy.
- The journal is append-only through the store API, but database-file tampering is not cryptographically detectable.
- Caller supplies quotes and marks; the EOD controller checks symbol, bid/ask geometry and quote age but no independent market-data validation service is connected.
- EOD blocked status is an in-process result, not an operational alert or broker-side emergency-close mechanism. No scheduler currently guarantees that the controller is invoked before the deadline.
- No broker, Demo or Live adapter exists.
- No account-currency conversion, contract-specification registry, margin model, fees, swaps or realistic partial-fill/slippage model.
- Daily P&L uses the engine's simulated fills and must never be represented as broker P&L.
- Session date and cutoff are UTC-only test controls; production must use the broker's authoritative trading calendar and timezone.
- This package is a development harness, not a recommendation to trade or evidence of profitability.

All production and broker connectivity work remains separately gated. Live trading stays disabled.
