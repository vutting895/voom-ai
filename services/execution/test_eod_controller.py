"""Tests for deadline- and quote-aware PAPER EOD flattening."""
import tempfile
import unittest
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal as D
from pathlib import Path

from services.execution.eod_controller import EODStatus, PaperEODController
from services.execution.paper_engine.engine import PaperExecutionEngine
from services.execution.paper_engine.models import PaperPolicy, PaperQuote, PaperSignal, Side
from services.execution.paper_engine.store import SQLitePaperStore

UTC = timezone.utc
OPEN_TIME = datetime(2026, 11, 25, 10, 0, tzinfo=UTC)
EOD_TIME = datetime(2026, 11, 25, 22, 0, tzinfo=UTC)


def policy():
    return PaperPolicy(
        max_trade_risk=D("100"), max_aggregate_risk=D("200"),
        max_daily_loss=D("50"), daily_profit_target=D("40"),
        max_open_positions=3, max_spread=D("0.5"),
        max_entry_deviation=D("1"), entry_cutoff_utc=time(20, 0),
        flatten_deadline_utc=time(22, 0), quote_max_age_seconds=5,
    )


def signal(signal_id, side, idem):
    return PaperSignal(
        signal_id=signal_id, idempotency_key=idem, symbol="XAUUSDm",
        side=side, quantity=D("1"), expected_entry=D("2000"),
        stop_loss=D("1990") if side is Side.BUY else D("2010"),
        take_profit=D("2020") if side is Side.BUY else D("1980"),
        value_per_price_unit=D("1"), created_at=OPEN_TIME,
        expires_at=OPEN_TIME + timedelta(minutes=1),
    )


def quote(observed_at=None):
    return PaperQuote("XAUUSDm", D("1999.8"), D("2000.2"),
                      observed_at or EOD_TIME - timedelta(seconds=1))


class PaperEODControllerTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.engine = PaperExecutionEngine(
            starting_equity=D("10000"), policy=policy(),
            trading_day=date(2026, 11, 25),
            store=SQLitePaperStore(Path(self.temp_dir.name) / "paper.db"),
        )
        self.controller = PaperEODController()

    def tearDown(self):
        self.temp_dir.cleanup()

    def open_two_sides(self):
        buy = self.engine.submit(
            signal("buy-signal", Side.BUY, "buy-idem"),
            quote(OPEN_TIME), now=OPEN_TIME,
        )
        sell = self.engine.submit(
            signal("sell-signal", Side.SELL, "sell-idem"),
            quote(OPEN_TIME), now=OPEN_TIME,
        )
        return buy.position_id, sell.position_id

    def test_before_deadline_does_not_flatten(self):
        self.open_two_sides()
        result = self.controller.run(
            self.engine, {"XAUUSDm": quote()}, now=EOD_TIME - timedelta(seconds=1)
        )
        self.assertEqual(result.status, EODStatus.NOT_DUE)
        self.assertTrue(all(p.is_open for p in self.engine.positions.values()))

    def test_same_symbol_uses_bid_for_buy_and_ask_for_sell(self):
        buy_id, sell_id = self.open_two_sides()
        result = self.controller.run(
            self.engine, {"XAUUSDm": quote()}, now=EOD_TIME
        )
        self.assertEqual(result.status, EODStatus.FLATTENED)
        self.assertEqual(set(result.closed_position_ids), {buy_id, sell_id})
        self.assertEqual(self.engine.positions[buy_id].mark_price, D("1999.8"))
        self.assertEqual(self.engine.positions[sell_id].mark_price, D("2000.2"))
        self.assertTrue(all(not p.is_open for p in self.engine.positions.values()))

    def test_missing_quote_fails_closed(self):
        self.open_two_sides()
        result = self.controller.run(self.engine, {}, now=EOD_TIME)
        self.assertEqual(result.status, EODStatus.BLOCKED_MISSING_QUOTE)
        self.assertTrue(all(p.is_open for p in self.engine.positions.values()))
        self.assertEqual(self.engine.store.read_events()[-1]["event_type"], "EOD_FLATTEN_BLOCKED")

    def test_stale_quote_fails_closed(self):
        self.open_two_sides()
        stale = quote(EOD_TIME - timedelta(seconds=10))
        result = self.controller.run(
            self.engine, {"XAUUSDm": stale}, now=EOD_TIME
        )
        self.assertEqual(result.status, EODStatus.BLOCKED_STALE_QUOTE)
        self.assertTrue(all(p.is_open for p in self.engine.positions.values()))

    def test_future_quote_fails_closed(self):
        self.open_two_sides()
        future = quote(EOD_TIME + timedelta(seconds=1))
        result = self.controller.run(
            self.engine, {"XAUUSDm": future}, now=EOD_TIME
        )
        self.assertEqual(result.status, EODStatus.BLOCKED_STALE_QUOTE)
        self.assertTrue(all(p.is_open for p in self.engine.positions.values()))

    def test_invalid_quote_fails_closed(self):
        self.open_two_sides()
        invalid = PaperQuote("WRONG", D("1999.8"), D("2000.2"), EOD_TIME)
        result = self.controller.run(
            self.engine, {"XAUUSDm": invalid}, now=EOD_TIME
        )
        self.assertEqual(result.status, EODStatus.BLOCKED_INVALID_QUOTE)
        self.assertTrue(all(p.is_open for p in self.engine.positions.values()))

    def test_naive_quote_timestamp_fails_closed(self):
        self.open_two_sides()
        malformed = PaperQuote(
            "XAUUSDm", D("1999.8"), D("2000.2"),
            datetime(2026, 11, 25, 21, 59, 59),
        )
        result = self.controller.run(
            self.engine, {"XAUUSDm": malformed}, now=EOD_TIME
        )
        self.assertEqual(result.status, EODStatus.BLOCKED_INVALID_QUOTE)
        self.assertTrue(all(p.is_open for p in self.engine.positions.values()))

    def test_non_finite_quote_price_fails_closed(self):
        self.open_two_sides()
        malformed = PaperQuote(
            "XAUUSDm", D("NaN"), D("2000.2"), EOD_TIME
        )
        result = self.controller.run(
            self.engine, {"XAUUSDm": malformed}, now=EOD_TIME
        )
        self.assertEqual(result.status, EODStatus.BLOCKED_INVALID_QUOTE)
        self.assertTrue(all(p.is_open for p in self.engine.positions.values()))

    def test_repeated_run_is_idempotent_after_flatten(self):
        self.open_two_sides()
        first = self.controller.run(
            self.engine, {"XAUUSDm": quote()}, now=EOD_TIME
        )
        second = self.controller.run(
            self.engine, {"XAUUSDm": quote()}, now=EOD_TIME
        )
        self.assertEqual(first.status, EODStatus.FLATTENED)
        self.assertEqual(second.status, EODStatus.NO_OPEN_POSITIONS)
        self.assertEqual(len(self.engine.store.read_events()), 3)

    def test_flatten_survives_restart(self):
        buy_id, sell_id = self.open_two_sides()
        self.controller.run(self.engine, {"XAUUSDm": quote()}, now=EOD_TIME)
        recovered = PaperExecutionEngine(
            starting_equity=D("10000"), policy=policy(),
            trading_day=date(2026, 11, 25),
            store=SQLitePaperStore(Path(self.temp_dir.name) / "paper.db"),
        )
        self.assertFalse(recovered.positions[buy_id].is_open)
        self.assertFalse(recovered.positions[sell_id].is_open)
        self.assertEqual(recovered.positions[buy_id].mark_price, D("1999.8"))
        self.assertEqual(recovered.positions[sell_id].mark_price, D("2000.2"))


if __name__ == "__main__":
    unittest.main()
