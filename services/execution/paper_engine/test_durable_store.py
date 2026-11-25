"""Durability and recovery tests for the PAPER-only SQLite store."""
import sqlite3
import tempfile
import unittest
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal as D
from pathlib import Path

from services.execution.paper_engine.engine import PaperExecutionEngine
from services.execution.paper_engine.models import PaperPolicy, PaperQuote, PaperSignal, ResultCode, Side
from services.execution.paper_engine.store import SQLitePaperStore

UTC = timezone.utc
NOW = datetime(2026, 11, 25, 10, 0, tzinfo=UTC)


def make_policy():
    return PaperPolicy(
        max_trade_risk=D("100"), max_aggregate_risk=D("200"),
        max_daily_loss=D("50"), daily_profit_target=D("40"),
        max_open_positions=2, max_spread=D("0.5"),
        max_entry_deviation=D("1"), entry_cutoff_utc=time(20, 0),
        flatten_deadline_utc=time(22, 0), quote_max_age_seconds=5,
    )


def make_signal():
    return PaperSignal(
        signal_id="durable-sig-1", idempotency_key="durable-idem-1",
        symbol="XAUUSDm", side=Side.BUY, quantity=D("1"),
        expected_entry=D("2000"), stop_loss=D("1990"),
        take_profit=D("2020"), value_per_price_unit=D("1"),
        created_at=NOW, expires_at=NOW + timedelta(minutes=1),
    )


def make_quote():
    return PaperQuote("XAUUSDm", D("1999.9"), D("2000"), NOW)


class DurablePaperExecutionTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "paper.sqlite3"

    def tearDown(self):
        self.temp_dir.cleanup()

    def make_engine(self):
        return PaperExecutionEngine(
            starting_equity=D("10000"), policy=make_policy(),
            trading_day=date(2026, 11, 25),
            store=SQLitePaperStore(self.db_path),
        )

    def test_open_position_and_idempotency_survive_restart(self):
        first_engine = self.make_engine()
        first_result = first_engine.submit(make_signal(), make_quote(), now=NOW)
        self.assertEqual(first_result.code, ResultCode.PAPER_SIMULATED)

        recovered = self.make_engine()
        self.assertIn(first_result.position_id, recovered.positions)
        self.assertTrue(recovered.positions[first_result.position_id].is_open)
        replay = recovered.submit(make_signal(), make_quote(), now=NOW)
        self.assertEqual(replay, first_result)
        self.assertEqual(len(recovered.positions), 1)

    def test_closed_position_and_daily_lock_survive_restart(self):
        engine = self.make_engine()
        opened = engine.submit(make_signal(), make_quote(), now=NOW)
        engine.close_position(
            opened.position_id, price=D("2050"),
            now=NOW + timedelta(seconds=1), reason="TEST_PROFIT",
        )
        recovered = self.make_engine()
        position = recovered.positions[opened.position_id]
        self.assertFalse(position.is_open)
        self.assertEqual(position.close_reason, "TEST_PROFIT")
        self.assertTrue(recovered.entry_locked)
        self.assertEqual(recovered.lock_reason, "DAILY_PROFIT_TARGET")

    def test_eod_flatten_is_durable(self):
        engine = self.make_engine()
        opened = engine.submit(make_signal(), make_quote(), now=NOW)
        closed = engine.close_all(
            {"XAUUSDm": D("2005")},
            now=NOW.replace(hour=21), reason="END_OF_DAY",
        )
        self.assertEqual(closed, [opened.position_id])
        recovered = self.make_engine()
        self.assertFalse(recovered.positions[opened.position_id].is_open)
        self.assertEqual(recovered.positions[opened.position_id].close_reason, "END_OF_DAY")

    def test_policy_or_day_mismatch_fails_closed(self):
        engine = self.make_engine()
        engine.submit(make_signal(), make_quote(), now=NOW)
        with self.assertRaises(ValueError):
            PaperExecutionEngine(
                starting_equity=D("9000"), policy=make_policy(),
                trading_day=date(2026, 11, 25),
                store=SQLitePaperStore(self.db_path),
            )

    def test_snapshot_and_journal_event_commit_atomically(self):
        store = SQLitePaperStore(self.db_path)
        store.save_snapshot({"version": 1}, event_type="INITIAL",
                            event={"value": 1}, occurred_at=NOW.isoformat())
        with sqlite3.connect(self.db_path) as connection:
            connection.execute("""
                CREATE TRIGGER reject_journal_insert BEFORE INSERT ON paper_event_journal
                BEGIN SELECT RAISE(ABORT, 'injected journal failure'); END
            """)
        with self.assertRaises(sqlite3.IntegrityError):
            store.save_snapshot({"version": 2}, event_type="FAIL",
                                event={"value": 2}, occurred_at=NOW.isoformat())
        self.assertEqual(store.load_snapshot(), {"version": 1})
        self.assertEqual(len(store.read_events()), 1)

    def test_journal_is_append_only_and_ordered(self):
        store = SQLitePaperStore(self.db_path)
        store.save_snapshot({"n": 1}, event_type="ONE", event={}, occurred_at=NOW.isoformat())
        store.save_snapshot({"n": 2}, event_type="TWO", event={}, occurred_at=NOW.isoformat())
        events = store.read_events()
        self.assertEqual([event["event_type"] for event in events], ["ONE", "TWO"])
        self.assertLess(events[0]["sequence"], events[1]["sequence"])


if __name__ == "__main__":
    unittest.main()
