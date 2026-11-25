# Shared Contracts

Reserved for versioned, runtime-validated contracts shared by VOOM AI applications and NOVA Core.

Rules:
- Contracts are schemas, not authorization.
- Validate every request and response at runtime.
- Never trust a user ID, tenant ID, broker state or execution flag supplied by a client.
- Market data must include source, symbol, timeframe, timestamp and verification status.
- Analysis and paper simulation must use distinct types from broker/account activity.
- No order submission or broker-write contract is permitted in this package.
