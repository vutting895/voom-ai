"""Unit tests for deterministic pre-trade risk decisions."""
import unittest
from decimal import Decimal as D

from services.risk_engine import RiskEngine, RiskInput, RiskPolicy, RiskSide


class RiskEngineTests(unittest.TestCase):
    def setUp(self):
        self.engine = RiskEngine(RiskPolicy(
            max_trade_risk=D("100"), max_aggregate_risk=D("150"),
            max_daily_loss=D("50"), daily_profit_target=D("40"),
            max_open_positions=3, max_spread=D("0.5"), max_entry_deviation=D("1"),
        ))
        self.base = dict(side=RiskSide.BUY, bid=D("1999.9"), ask=D("2000"),
                         expected_entry=D("2000"), stop_loss=D("1990"),
                         take_profit=D("2020"), quantity=D("1"),
                         value_per_price_unit=D("1"), current_open_risk=D("0"),
                         open_positions=0, daily_pnl=D("0"), entry_locked=False)

    def evaluate(self, **changes):
        values = dict(self.base)
        values.update(changes)
        return self.engine.evaluate_entry(RiskInput(**values))

    def test_valid_buy_is_approved_with_calculated_risk(self):
        result = self.evaluate()
        self.assertTrue(result.allowed)
        self.assertEqual(result.fill_price, D("2000"))
        self.assertEqual(result.risk_amount, D("10"))

    def test_spread_limit_rejected(self):
        self.assertEqual(self.evaluate(bid=D("1998")).reason_code, "SPREAD_LIMIT_EXCEEDED")

    def test_invalid_stop_geometry_rejected(self):
        self.assertEqual(self.evaluate(stop_loss=D("2000")).reason_code, "INVALID_BUY_PROTECTION_LEVELS")

    def test_per_trade_risk_rejected(self):
        result = self.evaluate(quantity=D("11"))
        self.assertEqual(result.reason_code, "PER_TRADE_RISK_LIMIT")

    def test_aggregate_risk_rejected(self):
        result = self.evaluate(current_open_risk=D("145"))
        self.assertEqual(result.reason_code, "AGGREGATE_OPEN_RISK_LIMIT")

    def test_position_limit_rejected(self):
        result = self.evaluate(open_positions=3)
        self.assertEqual(result.reason_code, "MAX_OPEN_POSITIONS")

    def test_daily_loss_and_profit_locks(self):
        self.assertEqual(self.engine.daily_lock_reason(D("-50")), "DAILY_LOSS_LIMIT")
        self.assertEqual(self.engine.daily_lock_reason(D("40")), "DAILY_PROFIT_TARGET")

    def test_existing_entry_lock_rejected(self):
        self.assertEqual(self.evaluate(entry_locked=True).reason_code, "ENTRY_LOCKED")

    def test_sell_protection_geometry(self):
        result = self.evaluate(side=RiskSide.SELL, bid=D("2000"), ask=D("2000.1"),
                               expected_entry=D("2000"), stop_loss=D("2010"), take_profit=D("1980"))
        self.assertTrue(result.allowed)
        self.assertEqual(result.fill_price, D("2000"))


if __name__ == "__main__":
    unittest.main()
