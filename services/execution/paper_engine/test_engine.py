"""Standard-library tests for the PAPER-only engine. Run: python -m unittest discover -s services/execution/paper_engine -p 'test_*.py'"""
import unittest
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal as D

from engine import PaperExecutionEngine
from models import PaperPolicy, PaperQuote, PaperSignal, ResultCode, Side

UTC = timezone.utc
NOW = datetime(2026, 11, 25, 10, 0, tzinfo=UTC)


def make_engine(**overrides):
    values = dict(max_trade_risk=D("100"), max_aggregate_risk=D("200"),
                  max_daily_loss=D("50"), daily_profit_target=D("40"),
                  max_open_positions=2, max_spread=D("0.5"),
                  max_entry_deviation=D("1"), entry_cutoff_utc=__import__('datetime').time(20, 0),
                  flatten_deadline_utc=__import__('datetime').time(22, 0), quote_max_age_seconds=5)
    values.update(overrides)
    return PaperExecutionEngine(starting_equity=D("10000"), policy=PaperPolicy(**values), trading_day=date(2026, 11, 25))


def signal(**overrides):
    values = dict(signal_id="sig-1", idempotency_key="idem-1", symbol="XAUUSDm", side=Side.BUY,
                  quantity=D("1"), expected_entry=D("2000"), stop_loss=D("1990"),
                  take_profit=D("2020"), value_per_price_unit=D("1"),
                  created_at=NOW, expires_at=NOW + timedelta(minutes=1))
    values.update(overrides)
    return PaperSignal(**values)


def quote(**overrides):
    values = dict(symbol="XAUUSDm", bid=D("1999.9"), ask=D("2000"), observed_at=NOW)
    values.update(overrides)
    return PaperQuote(**values)


class PaperEngineTests(unittest.TestCase):
    def test_paper_fill_has_no_broker_claim(self):
        result = make_engine().submit(signal(), quote(), now=NOW)
        self.assertEqual(result.code, ResultCode.PAPER_SIMULATED)
        self.assertEqual(result.reason, "PAPER_FILL_ONLY_NO_BROKER_IO")

    def test_missing_protection_rejected(self):
        result = make_engine().submit(signal(stop_loss=D("2000")), quote(), now=NOW)
        self.assertEqual(result.code, ResultCode.REJECTED)
        self.assertEqual(result.reason, "INVALID_BUY_PROTECTION_LEVELS")

    def test_stale_quote_rejected(self):
        result = make_engine().submit(signal(), quote(observed_at=NOW - timedelta(seconds=6)), now=NOW)
        self.assertEqual(result.reason, "STALE_OR_FUTURE_QUOTE")

    def test_spread_limit_rejected(self):
        result = make_engine().submit(signal(), quote(bid=D("1998")), now=NOW)
        self.assertEqual(result.reason, "SPREAD_LIMIT_EXCEEDED")

    def test_duplicate_idempotency_returns_original_result(self):
        engine = make_engine()
        first = engine.submit(signal(), quote(), now=NOW)
        second = engine.submit(signal(), quote(), now=NOW)
        self.assertEqual(first, second)
        self.assertEqual(len(engine.positions), 1)

    def test_idempotency_payload_conflict_rejected(self):
        engine = make_engine()
        engine.submit(signal(), quote(), now=NOW)
        result = engine.submit(signal(quantity=D("2")), quote(), now=NOW)
        self.assertEqual(result.code, ResultCode.IDEMPOTENCY_CONFLICT)

    def test_max_open_positions_enforced(self):
        engine = make_engine(max_open_positions=1)
        engine.submit(signal(), quote(), now=NOW)
        result = engine.submit(signal(signal_id="sig-2", idempotency_key="idem-2"), quote(), now=NOW)
        self.assertEqual(result.reason, "MAX_OPEN_POSITIONS")

    def test_take_profit_closes_paper_position(self):
        engine = make_engine()
        opened = engine.submit(signal(), quote(), now=NOW)
        closed = engine.mark("XAUUSDm", D("2021"), now=NOW + timedelta(seconds=1))
        self.assertEqual(closed, [opened.position_id])
        self.assertFalse(engine.positions[opened.position_id].is_open)
        self.assertEqual(engine.positions[opened.position_id].close_reason, "TAKE_PROFIT")

    def test_daily_profit_lock_blocks_new_entries(self):
        engine = make_engine(daily_profit_target=D("10"))
        opened = engine.submit(signal(), quote(), now=NOW)
        engine.close_position(opened.position_id, price=D("2010"), now=NOW + timedelta(seconds=1), reason="TEST")
        result = engine.submit(signal(signal_id="sig-2", idempotency_key="idem-2"), quote(), now=NOW + timedelta(seconds=2))
        self.assertEqual(result.reason, "DAILY_PROFIT_TARGET")

    def test_cannot_roll_day_with_open_position(self):
        engine = make_engine()
        engine.submit(signal(), quote(), now=NOW)
        with self.assertRaises(RuntimeError):
            engine.start_next_day(date(2026, 11, 26), new_starting_equity=D("10000"))

    def test_end_of_day_requires_close_marks(self):
        engine = make_engine()
        engine.submit(signal(), quote(), now=NOW)
        with self.assertRaises(ValueError):
            engine.close_all({}, now=NOW + timedelta(hours=5))

    def test_entry_cutoff_rejects_new_positions(self):
        engine = make_engine()
        after_cutoff = NOW.replace(hour=20, minute=1)
        late_signal = signal(created_at=after_cutoff, expires_at=after_cutoff + timedelta(minutes=1))
        result = engine.submit(late_signal, quote(observed_at=after_cutoff), now=after_cutoff)
        self.assertEqual(result.reason, "ENTRY_CUTOFF_REACHED")

    def test_close_all_validates_all_marks_before_mutation(self):
        engine = make_engine(max_open_positions=2)
        first = engine.submit(signal(), quote(), now=NOW)
        second_signal = signal(signal_id="sig-2", idempotency_key="idem-2")
        second = engine.submit(second_signal, quote(), now=NOW)
        with self.assertRaises(ValueError):
            engine.close_all({}, now=NOW + timedelta(hours=5))
        self.assertTrue(engine.positions[first.position_id].is_open)
        self.assertTrue(engine.positions[second.position_id].is_open)

    def test_wrong_trading_day_rejected(self):
        engine = make_engine()
        next_day = NOW + timedelta(days=1)
        result = engine.submit(signal(created_at=next_day, expires_at=next_day + timedelta(minutes=1)),
                               quote(observed_at=next_day), now=next_day)
        self.assertEqual(result.reason, "INTRADAY_ONLY_WRONG_TRADING_DAY")


if __name__ == "__main__":
    unittest.main()
