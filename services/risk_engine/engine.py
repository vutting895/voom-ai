"""Deterministic pre-trade risk engine. Contains no broker or network integrations."""
from decimal import Decimal

from .models import RiskDecision, RiskInput, RiskPolicy, RiskSide


class RiskEngine:
    def __init__(self, policy: RiskPolicy):
        self.policy = policy

    def daily_lock_reason(self, daily_pnl: Decimal) -> str | None:
        if daily_pnl <= -self.policy.max_daily_loss:
            return "DAILY_LOSS_LIMIT"
        if daily_pnl >= self.policy.daily_profit_target:
            return "DAILY_PROFIT_TARGET"
        return None

    def evaluate_entry(self, item: RiskInput) -> RiskDecision:
        if item.entry_locked:
            return RiskDecision(False, "ENTRY_LOCKED")
        lock_reason = self.daily_lock_reason(item.daily_pnl)
        if lock_reason:
            return RiskDecision(False, lock_reason)
        if item.open_positions >= self.policy.max_open_positions:
            return RiskDecision(False, "MAX_OPEN_POSITIONS")
        if item.quantity <= 0 or item.expected_entry <= 0 or item.stop_loss <= 0 or item.take_profit <= 0 or item.value_per_price_unit <= 0:
            return RiskDecision(False, "INVALID_NON_POSITIVE_VALUE")
        if item.bid <= 0 or item.ask < item.bid:
            return RiskDecision(False, "INVALID_OR_MISMATCHED_QUOTE")
        if item.ask - item.bid > self.policy.max_spread:
            return RiskDecision(False, "SPREAD_LIMIT_EXCEEDED")
        fill = item.ask if item.side is RiskSide.BUY else item.bid
        if abs(fill - item.expected_entry) > self.policy.max_entry_deviation:
            return RiskDecision(False, "ENTRY_DEVIATION_EXCEEDED")
        if item.side is RiskSide.BUY and not (item.stop_loss < fill < item.take_profit):
            return RiskDecision(False, "INVALID_BUY_PROTECTION_LEVELS")
        if item.side is RiskSide.SELL and not (item.take_profit < fill < item.stop_loss):
            return RiskDecision(False, "INVALID_SELL_PROTECTION_LEVELS")
        risk = abs(fill - item.stop_loss) * item.quantity * item.value_per_price_unit
        if risk > self.policy.max_trade_risk:
            return RiskDecision(False, "PER_TRADE_RISK_LIMIT", fill, risk)
        if item.current_open_risk + risk > self.policy.max_aggregate_risk:
            return RiskDecision(False, "AGGREGATE_OPEN_RISK_LIMIT", fill, risk)
        return RiskDecision(True, "RISK_APPROVED", fill, risk)
