"""Durable PAPER-only EOD watchdog state and lease coordination.

This module is polled by an external caller; it does not create timers or workers.
It has no broker, network, credential, or order-dispatch capability.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from enum import Enum
from typing import Mapping

from .eod_controller import EODResult, EODStatus, PaperEODController
from .paper_engine.engine import PaperExecutionEngine
from .paper_engine.models import PaperQuote
from .paper_engine.store import SQLitePaperStore


class JobStatus(str, Enum):
    PENDING = "PENDING"
    CLAIMED = "CLAIMED"
    BLOCKED = "BLOCKED"
    COMPLETED = "COMPLETED"


class ClaimStatus(str, Enum):
    CLAIMED = "CLAIMED"
    NOT_DUE = "NOT_DUE"
    BUSY = "BUSY"
    ALREADY_COMPLETED = "ALREADY_COMPLETED"


@dataclass(frozen=True)
class EODClaim:
    status: ClaimStatus
    job_key: str
    owner: str | None = None
    attempt: int = 0
    lease_expires_at: datetime | None = None
    escalation: Mapping[str, str] | None = None


@dataclass(frozen=True)
class SchedulerRunResult:
    claim: EODClaim
    eod_result: EODResult | None = None
    completed: bool = False
    reason: str = ""


class DurablePaperEODScheduler:
    """SQLite-backed single-host lease and retry state for a PAPER EOD controller."""

    def __init__(
        self,
        store: SQLitePaperStore,
        *,
        lease_seconds: int = 30,
        escalation_grace_seconds: int = 60,
    ) -> None:
        if lease_seconds <= 0 or escalation_grace_seconds < 0:
            raise ValueError("lease_seconds must be positive and grace must be non-negative")
        self.database_path = store.database_path
        self.lease_seconds = lease_seconds
        self.escalation_grace_seconds = escalation_grace_seconds
        with closing(self._connect()) as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS paper_eod_jobs (
                    job_key TEXT PRIMARY KEY,
                    trading_day TEXT NOT NULL,
                    flatten_deadline_utc TEXT NOT NULL,
                    status TEXT NOT NULL,
                    attempt_count INTEGER NOT NULL DEFAULT 0,
                    owner TEXT,
                    lease_expires_at TEXT,
                    last_result TEXT,
                    escalation_json TEXT,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT
                );
                """
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=10.0, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout = 10000")
        connection.execute("PRAGMA synchronous = FULL")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    @staticmethod
    def _require_utc(value: datetime) -> None:
        if value.tzinfo is None or value.utcoffset() != timedelta(0):
            raise ValueError("timezone-aware UTC datetime required")

    @staticmethod
    def job_key(trading_day: date) -> str:
        return f"paper-eod:{trading_day.isoformat()}"

    def claim(
        self,
        *,
        trading_day: date,
        flatten_deadline_utc: time,
        owner: str,
        now: datetime,
    ) -> EODClaim:
        self._require_utc(now)
        if not owner.strip():
            raise ValueError("owner is required")
        deadline = datetime.combine(trading_day, flatten_deadline_utc, tzinfo=timezone.utc)
        key = self.job_key(trading_day)
        if now < deadline:
            return EODClaim(ClaimStatus.NOT_DUE, key)
        escalation = None
        if now > deadline + timedelta(seconds=self.escalation_grace_seconds):
            escalation = {
                "event": "EOD_DEADLINE_MISSED",
                "job_key": key,
                "deadline_utc": deadline.isoformat(),
                "observed_at": now.isoformat(),
                "severity": "CRITICAL",
                "scope": "PAPER_LEDGER_ONLY",
            }
        expires = now + timedelta(seconds=self.lease_seconds)
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                """INSERT OR IGNORE INTO paper_eod_jobs
                   (job_key, trading_day, flatten_deadline_utc, status, updated_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (key, trading_day.isoformat(), flatten_deadline_utc.isoformat(),
                 JobStatus.PENDING.value, now.isoformat()),
            )
            row = connection.execute(
                "SELECT * FROM paper_eod_jobs WHERE job_key=?", (key,)
            ).fetchone()
            if row["status"] == JobStatus.COMPLETED.value:
                connection.commit()
                return EODClaim(ClaimStatus.ALREADY_COMPLETED, key, attempt=row["attempt_count"])
            old_expiry = datetime.fromisoformat(row["lease_expires_at"]) if row["lease_expires_at"] else None
            if row["status"] == JobStatus.CLAIMED.value and old_expiry and old_expiry > now:
                connection.commit()
                return EODClaim(ClaimStatus.BUSY, key, owner=row["owner"],
                                attempt=row["attempt_count"], lease_expires_at=old_expiry)
            attempt = int(row["attempt_count"]) + 1
            merged_escalation = json.loads(row["escalation_json"]) if row["escalation_json"] else None
            if escalation:
                merged_escalation = escalation
                connection.execute(
                    """INSERT INTO paper_event_journal(event_type, event_json, occurred_at)
                       VALUES(?, ?, ?)""",
                    ("EOD_DEADLINE_MISSED", json.dumps(escalation, sort_keys=True), now.isoformat()),
                )
            connection.execute(
                """UPDATE paper_eod_jobs SET status=?, attempt_count=?, owner=?,
                   lease_expires_at=?, escalation_json=?, updated_at=? WHERE job_key=?""",
                (JobStatus.CLAIMED.value, attempt, owner, expires.isoformat(),
                 json.dumps(merged_escalation, sort_keys=True) if merged_escalation else None,
                 now.isoformat(), key),
            )
            connection.execute(
                """INSERT INTO paper_event_journal(event_type, event_json, occurred_at)
                   VALUES(?, ?, ?)""",
                ("EOD_JOB_CLAIMED", json.dumps({
                    "job_key": key, "owner": owner, "attempt": attempt,
                    "lease_expires_at": expires.isoformat(),
                }, sort_keys=True), now.isoformat()),
            )
            connection.commit()
        return EODClaim(ClaimStatus.CLAIMED, key, owner, attempt, expires, merged_escalation)

    def mark_blocked(
        self, claim: EODClaim, *, reason: str, result: str, now: datetime
    ) -> None:
        self._require_utc(now)
        if claim.status is not ClaimStatus.CLAIMED or not claim.owner:
            raise ValueError("an active claim is required")
        payload = {"job_key": claim.job_key, "owner": claim.owner,
                   "reason": reason, "result": result, "attempt": claim.attempt}
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            cursor = connection.execute(
                """UPDATE paper_eod_jobs SET status=?, owner=NULL, lease_expires_at=NULL,
                   last_result=?, updated_at=? WHERE job_key=? AND status=? AND owner=?
                   AND attempt_count=? AND lease_expires_at>?""",
                (JobStatus.BLOCKED.value, json.dumps(payload, sort_keys=True),
                 now.isoformat(), claim.job_key, JobStatus.CLAIMED.value,
                 claim.owner, claim.attempt, now.isoformat()),
            )
            if cursor.rowcount != 1:
                connection.rollback()
                raise RuntimeError("claim lost or superseded; refusing stale worker update")
            connection.execute(
                "INSERT INTO paper_event_journal(event_type, event_json, occurred_at) VALUES(?, ?, ?)",
                ("EOD_JOB_BLOCKED", json.dumps(payload, sort_keys=True), now.isoformat()),
            )
            connection.commit()

    def complete(
        self,
        claim: EODClaim,
        *,
        engine: PaperExecutionEngine,
        eod_result: EODResult,
        now: datetime,
    ) -> None:
        self._require_utc(now)
        if claim.status is not ClaimStatus.CLAIMED or not claim.owner:
            raise ValueError("an active claim is required")
        if any(position.is_open for position in engine.positions.values()):
            raise RuntimeError("cannot complete EOD while PAPER positions remain open")
        if eod_result.status not in (EODStatus.FLATTENED, EODStatus.NO_OPEN_POSITIONS):
            raise ValueError("only a confirmed PAPER-ledger flat result can complete the job")
        payload = {
            "job_key": claim.job_key, "owner": claim.owner,
            "attempt": claim.attempt, "eod_status": eod_result.status.value,
            "closed_position_ids": list(eod_result.closed_position_ids),
            "scope": "PAPER_LEDGER_ONLY",
        }
        with closing(self._connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            cursor = connection.execute(
                """UPDATE paper_eod_jobs SET status=?, owner=NULL, lease_expires_at=NULL,
                   last_result=?, updated_at=?, completed_at=?
                   WHERE job_key=? AND status=? AND owner=? AND attempt_count=? AND lease_expires_at>?""",
                (JobStatus.COMPLETED.value, json.dumps(payload, sort_keys=True),
                 now.isoformat(), now.isoformat(), claim.job_key,
                 JobStatus.CLAIMED.value, claim.owner, claim.attempt, now.isoformat()),
            )
            if cursor.rowcount != 1:
                connection.rollback()
                raise RuntimeError("claim lost or superseded; refusing stale completion")
            connection.execute(
                "INSERT INTO paper_event_journal(event_type, event_json, occurred_at) VALUES(?, ?, ?)",
                ("EOD_JOB_COMPLETED", json.dumps(payload, sort_keys=True), now.isoformat()),
            )
            connection.commit()

    def run_once(
        self,
        engine: PaperExecutionEngine,
        controller: PaperEODController,
        quotes: Mapping[str, PaperQuote],
        *,
        owner: str,
        now: datetime,
    ) -> SchedulerRunResult:
        if engine.MODE != "PAPER":
            raise ValueError("scheduler only accepts PAPER execution engines")
        claim = self.claim(
            trading_day=engine.trading_day,
            flatten_deadline_utc=engine.policy.flatten_deadline_utc,
            owner=owner, now=now,
        )
        if claim.status is not ClaimStatus.CLAIMED:
            return SchedulerRunResult(claim, reason=claim.status.value)
        try:
            result = controller.run(engine, quotes, now=now)
            if result.status in (EODStatus.FLATTENED, EODStatus.NO_OPEN_POSITIONS):
                self.complete(claim, engine=engine, eod_result=result, now=now)
                return SchedulerRunResult(claim, result, True, "PAPER ledger confirmed flat")
            self.mark_blocked(claim, reason=result.reason or result.status.value,
                              result=result.status.value, now=now)
            return SchedulerRunResult(claim, result, False, "retryable EOD block recorded")
        except Exception as exc:
            self.mark_blocked(claim, reason=f"{type(exc).__name__}: {exc}",
                              result="CONTROLLER_ERROR", now=now)
            return SchedulerRunResult(claim, None, False, "controller error recorded as retryable block")


__all__ = [
    "ClaimStatus", "DurablePaperEODScheduler", "EODClaim",
    "JobStatus", "SchedulerRunResult",
]
