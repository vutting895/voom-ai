# Deterministic Risk Engine

A broker-independent, deterministic pre-trade risk decision module. It has no network, broker SDK, credential or order-dispatch integration.

The Paper Execution Engine delegates entry decisions to this package. The module checks:

- Daily loss and daily profit entry locks
- Existing entry lock and maximum concurrent positions
- Positive quantity/prices and valid bid/ask
- Maximum spread and expected-entry deviation
- Side-correct stop-loss / take-profit geometry
- Per-trade monetary risk and aggregate open risk

The engine returns a decision and reason code. It never submits, cancels or closes an order. Policy values must be explicitly supplied; the package invents no production defaults.

Run its tests from repository root:

```bash
python -m unittest discover -s services/risk_engine -p 'test_*.py' -v
```

Production still requires authoritative account/contract metadata, currency conversion, margin and fee models, durable policy versioning, authorization and operational evidence.
