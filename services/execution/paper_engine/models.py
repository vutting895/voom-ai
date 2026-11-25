"""Typed models for paper-only execution. Monetary/price values use Decimal."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time
from decimal import Decimal
from enum import Enum


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class ResultCode(str, Enum):
    PAPER_SIMULATED = "PAPER_SIMULATED"
    REJECTED = "REJECTED"
    DUPLICATE = "DUPLICATE"
    IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT"


@dataclass(frozen=True)
class PaperPolicy:
    max_trade_risk: Decimal
    max_aggregate_risk: Decimal
    max_daily_loss: Decimal
    daily_profit_target: Decimal
    max_open_positions: int
    max_spread: Decimal
    max_entry_deviation: Decimal
    entry_cutoff_utc: time
    flatten_deadline_utc: time
    quote_max_age_seconds: int = 5

    def __post_init__(self) -> None:
        monetary = (self.max_trade_risk, self.max_aggregate_risk, self.max_daily_loss,
                    self.daily_profit_target, self.max_spread, self.max_entry_deviation)
        if any(value <= 0 for value in monetary):
            raise ValueError("All policy limits must be positive")
        if self.max_open_positions < 1 or self.quote_max_age_seconds < 1:
            raise ValueError("Position and quote-age limits must be positive")
        if self.flatten_deadline_utc <= self.entry_cutoff_utc:
            raise ValueError("Flatten deadline must be later than entry cutoff")


@dataclass(frozen=True)
class PaperSignal:
    signal_id: str
    idempotency_key: str
    symbol: str
    side: Side
    quantity: Decimal
    expected_entry: Decimal
    stop_loss: Decimal
    take_profit: Decimal
    value_per_price_unit: Decimal
    created_at: datetime
    expires_at: datetime


@dataclass(frozen=True)
class PaperQuote:
    symbol: str
    bid: Decimal
    ask: Decimal
    observed_at: datetime


@dataclass(frozen=True)
class PaperResult:
    code: ResultCode
    intent_id: str
    reason: str
    fill_price: Decimal | None = None
    position_id: str | None = None
    risk_amount: Decimal | None = None


@dataclass
class PaperPosition:
    position_id: str
    signal_id: str
    symbol: str
    side: Side
    quantity: Decimal
    entry_price: Decimal
    stop_loss: Decimal
    take_profit: Decimal
    value_per_price_unit: Decimal
    risk_amount: Decimal
    opened_at: datetime
    trading_day: str
    mark_price: Decimal
    realized_pnl: Decimal = Decimal("0")
    closed_at: datetime | None = None
    close_reason: str | None = None

    @property
    def is_open(self) -> bool:
        return self.closed_at is None

    def unrealized_pnl(self) -> Decimal:
        direction = Decimal("1") if self.side is Side.BUY else Decimal("-1")
        return (self.mark_price - self.entry_price) * direction * self.quantity * self.value_per_price_unit
