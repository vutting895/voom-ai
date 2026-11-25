"""Typed, broker-independent risk policy and evaluation models."""
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class RiskSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


@dataclass(frozen=True)
class RiskPolicy:
    max_trade_risk: Decimal
    max_aggregate_risk: Decimal
    max_daily_loss: Decimal
    daily_profit_target: Decimal
    max_open_positions: int
    max_spread: Decimal
    max_entry_deviation: Decimal

    def __post_init__(self) -> None:
        values = (self.max_trade_risk, self.max_aggregate_risk, self.max_daily_loss,
                  self.daily_profit_target, self.max_spread, self.max_entry_deviation)
        if any(value <= 0 for value in values):
            raise ValueError("Risk limits must be positive")
        if self.max_open_positions < 1:
            raise ValueError("max_open_positions must be positive")


@dataclass(frozen=True)
class RiskInput:
    side: RiskSide
    bid: Decimal
    ask: Decimal
    expected_entry: Decimal
    stop_loss: Decimal
    take_profit: Decimal
    quantity: Decimal
    value_per_price_unit: Decimal
    current_open_risk: Decimal
    open_positions: int
    daily_pnl: Decimal
    entry_locked: bool = False


@dataclass(frozen=True)
class RiskDecision:
    allowed: bool
    reason_code: str
    fill_price: Decimal | None = None
    risk_amount: Decimal | None = None
