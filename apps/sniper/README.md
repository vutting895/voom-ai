# VOOM AI Sniper

Migration boundary for vutting895/Voom-ai-sniper.

Planned scope: read-only market data and provenance; signal generation and analysis; risk calculations and backtesting; intraday strategy research with no intentional overnight positions.

Import status: NOT STARTED.

Hard safety boundary:
- LIVE TRADING OFF.
- No order submission, broker write operations, deposits, withdrawals or transfers.
- Do not import mt5_execution_worker.py, Bitkub order adapters, or the legacy broker-auth route.
- Broker authentication remains disabled pending per-user authorization, tenant isolation and managed secret storage.
- Analysis output is not an execution instruction and must not be represented as a broker-confirmed fill.
- All paper simulation must be visibly distinct from real account activity.

Relevant upstream candidate: draft PR #2 in the source repository contains an execution-disabled API and package metadata corrections. Review it as source material; it is not evidence that the entire Sniper codebase is safe.
