"""Failure-stop guards for durable PAPER engine mutations."""
import tempfile
import unittest
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal as D
from pathlib import Path

from services.execution.paper_engine.engine import PaperExecutionEngine
from services.execution.paper_engine.models import PaperPolicy, PaperQuote, PaperSignal, Side
from services.execution.paper_engine.store import SQLitePaperStore

UTC = timezone.utc
NOW = datetime(2026, 11, 25, 10, 0, tzinfo=UTC)


def policy():
    return PaperPolicy(
        max_trade_risk=D("100"), max_aggregate_risk=D("200"),
        max_daily_loss=D("50"), daily_profit_target=D("40"),
        max_open_positions=2, max_spread=D("0.5"),
        max_entry_deviation=D("1"), entry_cutoff_utc=time(20, 0),
        flatten_deadline_utc=time(22, 0), quote_max_age_seconds=5,
    )


def signal():
    return PaperSignal(
        signal_id="guard-signal", idempotency_key="guard-idempotency",
        symbol="XAUUSDm", side=Side.BUY, quantity=D("1"),
        expected_entry=D("2000"), stop_loss=D("1990"),
        take_profit=D("2020"), value_per_price_unit=D("1"),
        created_at=NOW, expires_at=NOW + timedelta(minutes=1),
    )


def quote():
    return PaperQuote("XAUUSDm", D("1999.9"), D("2000"), NOW)


class StorageFailStopGuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = SQLitePaperStore(Path(self.tmp.name) / "paper.sqlite3")
        self.engine = PaperExecutionEngine(
            starting_equity=D("10000"), policy=policy(),
            trading_day=date(2026, 11, 25), store=self.store,
        )

    def tearDown(self):
        self.tmp.cleanup()

    def test_failed_submit_prevents_later_mark_mutation(self):
        original_save = self.store.save_snapshot

        def fail_save(*args, **kwargs):
            raise OSError("injected durable storage failure")

        self.store.save_snapshot = fail_save
        with self.assertRaises(OSError):
            self.engine.submit(signal(), quote(), now=NOW)
        self.assertEqual(len(self.engine.positions), 1)  # mutation preceded failed commit
        before = self.engine.positions[next(iter(self.engine.positions))].mark_price
        with self.assertRaisesRegex(RuntimeError, "failed-stop"):
            self.engine.mark("XAUUSDm", D("1990"), now=NOW + timedelta(seconds=1))
        after = self.engine.positions[next(iter(self.engine.positions))].mark_price
        self.assertEqual(after, before)
        self.store.save_snapshot = original_save

    def test_failed_storage_blocks_all_mutating_entrypoints(self):
        self.engine._storage_failed = True
        opened = self.engine.submit
        operations = [
            lambda: opened(signal(), quote(), now=NOW),
            lambda: self.engine.mark("XAUUSDm", D("2001"), now=NOW),
            lambda: self.engine.close_position("missing", price=D("2001"), now=NOW, reason="TEST"),
            lambda: self.engine.close_all({}, now=NOW),
            lambda: self.engine.start_next_day(date(2026, 11, 26), new_starting_equity=D("10000")),
        ]
        for operation in operations:
            with self.subTest(operation=operation):
                with self.assertRaisesRegex(RuntimeError, "failed-stop"):
                    operation()
        self.assertEqual(self.engine.positions, {})

if __name__ == "__main__":
    unittest.main()
