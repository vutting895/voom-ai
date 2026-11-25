# Paper Execution Engine

This package is an isolated, deterministic simulator. It delegates deterministic entry decisions to `services/risk_engine`. It has no broker adapter, network client, credential loader, order-write API, or MT5/Bitkub integration. It is not a live execution service.

## Run tests

From the repository root:

```bash
python -m unittest discover -s services/risk_engine -p 'test_*.py' -v
python -m unittest discover -s services/execution/paper_engine -p 'test_*.py' -v
```

## Behavior

- The engine only represents `PAPER` mode and simulates fills from caller-supplied quotes.
- Uses `Decimal` for prices, quantities and risk calculations.
- Requires UTC timestamps, fresh quotes, valid stop-loss/take-profit geometry, bounded spread and entry deviation.
- Enforces an explicitly configured UTC entry cutoff and flatten deadline; these are simulator inputs, not a broker holiday/session calendar.
- Applies per-trade risk, aggregate open risk, maximum open positions, daily loss and daily profit entry locks.
- Supports idempotency conflict detection and duplicate suppression in its in-memory process scope.
- Validates all required symbol marks before an end-of-day close, preventing partial in-memory flattening due to missing marks.
- Simulates stop/target exits and explicit end-of-day flattening using supplied paper marks.
- Refuses day rollover while any paper position remains open.

## Limitations — not production ready

- In-memory only: no database durability, transactional outbox, distributed locking or restart recovery.
- Caller supplies quotes and marks; no market data validation service is connected.
- No broker, Demo or Live adapter exists.
- No account-currency conversion, contract-specification registry, margin model, fees, swaps or realistic partial-fill/slippage model.
- Daily P&L uses the engine's simulated fills and must never be represented as broker P&L.
- Session date and cutoff are UTC-only test controls; production must use the broker's authoritative trading calendar and timezone.
- This package is a development harness, not a recommendation to trade or evidence of profitability.

All production and broker connectivity work remains separately gated. Live trading stays disabled.
