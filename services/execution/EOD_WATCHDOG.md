# PAPER EOD Watchdog

DurablePaperEODScheduler adds durable SQLite job state and a single-host lease around the existing PaperEODController.

## Contract

- One deterministic job key per PAPER trading day: paper-eod:YYYY-MM-DD.
- BEGIN IMMEDIATE serializes claims; an unexpired lease blocks other workers.
- An expired lease can be reclaimed. A stale worker cannot mark a reclaimed job blocked or completed.
- Blocked quote/controller attempts release the lease and remain retryable.
- Completion is accepted only for FLATTENED or NO_OPEN_POSITIONS and only after the PAPER engine reports zero open positions.
- Completion and incident events are journaled in the same SQLite database.
- A late poll creates a durable EOD_DEADLINE_MISSED escalation payload; it does not invent a quote, close price, or broker state.
- Repeated claims after completion return ALREADY_COMPLETED.

## Invocation

This is a pollable coordinator, not a process scheduler. A caller must invoke run_once at the required cadence and provide current quotes. The caller is responsible for process supervision, polling frequency, clock synchronization, and delivering the returned escalation payload to an operator. This package does not create OS timers, background workers, paging integrations, or external alerts.

## Scope and limitations

PAPER ledger only. No broker connection, Demo/Live credentials, order submission, network calls, or broker-side reconciliation. A completed job proves only that the local simulated ledger is flat. SQLite lease coordination is single-host; do not share this database across hosts or treat it as a distributed lock. A process crash after the PAPER flatten but before scheduler completion is recoverable: the next attempt observes NO_OPEN_POSITIONS and completes the job. Quotes remain caller-supplied and independently unverified.

ordersEnabled=false, executionEnabled=false, liveTradingEnabled=false. No Main merge, deployment, production database change, or broker linkage.
