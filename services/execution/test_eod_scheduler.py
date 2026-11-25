"""Durable lease, retry and completion tests for the PAPER EOD watchdog."""
import sqlite3
import tempfile
import threading
import unittest
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from services.execution.eod_controller import EODResult, EODStatus
from services.execution.eod_scheduler import (
    ClaimStatus, DurablePaperEODScheduler,
)
from services.execution.paper_engine.store import SQLitePaperStore

UTC = timezone.utc
DAY = date(2026, 11, 25)
DEADLINE = time(22, 0)
NOW = datetime(2026, 11, 25, 22, 2, tzinfo=UTC)


class FakePosition:
    def __init__(self, is_open=True):
        self.is_open = is_open


class FakeEngine:
    MODE = "PAPER"
    trading_day = DAY
    policy = type("Policy", (), {"flatten_deadline_utc": DEADLINE})()

    def __init__(self, open_positions=0):
        self.positions = {str(i): FakePosition() for i in range(open_positions)}


class DurableEODSchedulerTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.path = Path(self.temp_dir.name) / "paper.sqlite3"
        self.store = SQLitePaperStore(self.path)
        self.scheduler = DurablePaperEODScheduler(
            self.store, lease_seconds=10, escalation_grace_seconds=30
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_only_one_worker_can_claim_job(self):
        barrier = threading.Barrier(2)
        results = []

        def worker(name):
            barrier.wait()
            results.append(self.scheduler.claim(
                trading_day=DAY, flatten_deadline_utc=DEADLINE,
                owner=name, now=NOW,
            ))

        threads = [threading.Thread(target=worker, args=(f"worker-{i}",)) for i in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(sum(r.status is ClaimStatus.CLAIMED for r in results), 1)
        self.assertEqual(sum(r.status is ClaimStatus.BUSY for r in results), 1)

    def test_expired_lease_can_be_reclaimed(self):
        first = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="first", now=NOW,
        )
        second = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="second", now=NOW + timedelta(seconds=11),
        )
        self.assertEqual(first.status, ClaimStatus.CLAIMED)
        self.assertEqual(second.status, ClaimStatus.CLAIMED)
        self.assertEqual(second.attempt, 2)
        with self.assertRaises(RuntimeError):
            self.scheduler.mark_blocked(first, reason="stale worker", result="BLOCKED",
                                        now=NOW + timedelta(seconds=12))

    def test_expired_lease_cannot_complete_without_reclaim(self):
        claim = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker", now=NOW,
        )
        with self.assertRaises(RuntimeError):
            self.scheduler.complete(
                claim, engine=FakeEngine(),
                eod_result=EODResult(EODStatus.NO_OPEN_POSITIONS),
                now=NOW + timedelta(seconds=11),
            )

    def test_not_due_does_not_claim(self):
        result = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker", now=NOW.replace(hour=21),
        )
        self.assertEqual(result.status, ClaimStatus.NOT_DUE)

    def test_blocked_attempt_is_retryable(self):
        claim = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker", now=NOW,
        )
        self.scheduler.mark_blocked(
            claim, reason="quote stale", result=EODStatus.BLOCKED_STALE_QUOTE.value,
            now=NOW,
        )
        retry = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker-2", now=NOW + timedelta(seconds=1),
        )
        self.assertEqual(retry.status, ClaimStatus.CLAIMED)
        self.assertEqual(retry.attempt, 2)

    def test_restart_restores_claim_and_completion_state(self):
        claim = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker", now=NOW,
        )
        restarted = DurablePaperEODScheduler(self.store, lease_seconds=10)
        blocked = restarted.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="other", now=NOW + timedelta(seconds=1),
        )
        self.assertEqual(blocked.status, ClaimStatus.BUSY)
        self.scheduler.complete(
            claim, engine=FakeEngine(), eod_result=EODResult(EODStatus.NO_OPEN_POSITIONS),
            now=NOW,
        )
        again = restarted.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="other", now=NOW + timedelta(seconds=2),
        )
        self.assertEqual(again.status, ClaimStatus.ALREADY_COMPLETED)

    def test_cannot_complete_with_open_positions(self):
        claim = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker", now=NOW,
        )
        with self.assertRaises(RuntimeError):
            self.scheduler.complete(
                claim, engine=FakeEngine(open_positions=1),
                eod_result=EODResult(EODStatus.FLATTENED), now=NOW,
            )

    def test_missed_deadline_creates_escalation_payload(self):
        late = NOW + timedelta(minutes=5)
        claim = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker", now=late,
        )
        self.assertEqual(claim.escalation["event"], "EOD_DEADLINE_MISSED")
        self.assertEqual(claim.escalation["scope"], "PAPER_LEDGER_ONLY")
        events = self.store.read_events()
        self.assertIn("EOD_DEADLINE_MISSED", [event["event_type"] for event in events])

    def test_completion_is_idempotent_for_later_claimers(self):
        claim = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker", now=NOW,
        )
        self.scheduler.complete(
            claim, engine=FakeEngine(), eod_result=EODResult(EODStatus.NO_OPEN_POSITIONS),
            now=NOW,
        )
        second = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker-2", now=NOW + timedelta(seconds=1),
        )
        self.assertEqual(second.status, ClaimStatus.ALREADY_COMPLETED)

    def test_deadline_incident_is_not_duplicated_on_retry(self):
        first = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker-1", now=NOW + timedelta(minutes=5),
        )
        self.scheduler.mark_blocked(
            first, reason="quote unavailable", result="BLOCKED",
            now=NOW + timedelta(minutes=5),
        )
        self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker-2", now=NOW + timedelta(minutes=6),
        )
        events = self.store.read_events()
        missed = [event for event in events if event["event_type"] == "EOD_DEADLINE_MISSED"]
        self.assertEqual(len(missed), 1)

    def test_completion_and_journal_roll_back_together(self):
        claim = self.scheduler.claim(
            trading_day=DAY, flatten_deadline_utc=DEADLINE,
            owner="worker", now=NOW,
        )
        with sqlite3.connect(self.path) as connection:
            connection.execute("""
                CREATE TRIGGER reject_eod_completion
                BEFORE INSERT ON paper_event_journal
                WHEN NEW.event_type = 'EOD_JOB_COMPLETED'
                BEGIN SELECT RAISE(ABORT, 'injected journal failure'); END
            """)
        with self.assertRaises(sqlite3.IntegrityError):
            self.scheduler.complete(
                claim, engine=FakeEngine(),
                eod_result=EODResult(EODStatus.NO_OPEN_POSITIONS), now=NOW,
            )
        with sqlite3.connect(self.path) as connection:
            row = connection.execute(
                "SELECT status, owner FROM paper_eod_jobs WHERE job_key=?",
                (claim.job_key,),
            ).fetchone()
        self.assertEqual(row, ("CLAIMED", "worker"))
        self.assertNotIn("EOD_JOB_COMPLETED",
                         [event["event_type"] for event in self.store.read_events()])

    def test_claim_rejects_wrong_trading_day(self):
        with self.assertRaisesRegex(ValueError, "configured trading day"):
            self.scheduler.claim(
                trading_day=DAY - timedelta(days=1), flatten_deadline_utc=DEADLINE,
                owner="worker", now=NOW,
            )

    def test_utc_is_required(self):
        with self.assertRaises(ValueError):
            self.scheduler.claim(
                trading_day=DAY, flatten_deadline_utc=DEADLINE,
                owner="worker", now=datetime(2026, 11, 25, 22, 2),
            )


if __name__ == "__main__":
    unittest.main()
