"""Deterministic PAPER-only execution simulator; intentionally has no broker I/O."""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Mapping

from .models import (PaperPolicy, PaperPosition, PaperQuote, PaperResult,
                     PaperSignal, ResultCode, Side)


class PaperExecutionEngine:
    """In-memory paper ledger. It cannot connect to or submit to a broker."""

    MODE = "PAPER"

    def __init__(self, *, starting_equity: Decimal, policy: PaperPolicy, trading_day: date):
        if starting_equity <= 0:
            raise ValueError("starting_equity must be positive")
        self.starting_equity = starting_equity
        self.policy = policy
        self.trading_day = trading_day
        self.positions: dict[str, PaperPosition] = {}
        self.results: dict[str, PaperResult] = {}
        self._idempotency: dict[str, tuple[str, str]] = {}
        self.entry_locked = False
        self.lock_reason: str | None = None

    @staticmethod
    def _utc(value: datetime) -> bool:
        return value.tzinfo is not None and value.utcoffset() == timezone.utc.utcoffset(value)

    @staticmethod
    def _fingerprint(signal: PaperSignal) -> str:
        payload = {
            "signal_id": signal.signal_id, "symbol": signal.symbol, "side": signal.side.value,
            "quantity": str(signal.quantity), "expected_entry": str(signal.expected_entry),
            "stop_loss": str(signal.stop_loss), "take_profit": str(signal.take_profit),
            "value_per_price_unit": str(signal.value_per_price_unit),
            "created_at": signal.created_at.isoformat(), "expires_at": signal.expires_at.isoformat(),
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

    def daily_pnl(self) -> Decimal:
        realized = sum((p.realized_pnl for p in self.positions.values()), Decimal("0"))
        unrealized = sum((p.unrealized_pnl() for p in self.positions.values() if p.is_open), Decimal("0"))
        return realized + unrealized

    def aggregate_open_risk(self) -> Decimal:
        return sum((p.risk_amount for p in self.positions.values() if p.is_open), Decimal("0"))

    def _reject(self, signal: PaperSignal, reason: str) -> PaperResult:
        result = PaperResult(ResultCode.REJECTED, signal.signal_id, reason)
        self.results[signal.signal_id] = result
        return result

    def submit(self, signal: PaperSignal, quote: PaperQuote, *, now: datetime) -> PaperResult:
        """Validate and simulate an immediate fill using the supplied paper quote."""
        if not self._utc(now) or not self._utc(signal.created_at) or not self._utc(signal.expires_at) or not self._utc(quote.observed_at):
            return self._reject(signal, "TIMESTAMP_MUST_BE_UTC")
        if not isinstance(signal.side, Side):
            return self._reject(signal, "INVALID_SIDE")
        if signal.expires_at <= signal.created_at:
            return self._reject(signal, "INVALID_SIGNAL_EXPIRY")
        fingerprint = self._fingerprint(signal)
        previous = self._idempotency.get(signal.idempotency_key)
        if previous:
            old_fingerprint, old_signal_id = previous
            if old_fingerprint != fingerprint:
                return PaperResult(ResultCode.IDEMPOTENCY_CONFLICT, signal.signal_id, "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD")
            return self.results[old_signal_id]
        if not signal.signal_id or not signal.idempotency_key or not signal.symbol:
            return self._reject(signal, "IDENTIFIERS_REQUIRED")
        if signal.quantity <= 0 or signal.expected_entry <= 0 or signal.stop_loss <= 0 or signal.take_profit <= 0 or signal.value_per_price_unit <= 0:
            return self._reject(signal, "INVALID_NON_POSITIVE_VALUE")
        if signal.expires_at <= now or signal.created_at > now:
            return self._reject(signal, "SIGNAL_EXPIRED_OR_FROM_FUTURE")
        if signal.created_at.date() != self.trading_day or now.date() != self.trading_day:
            return self._reject(signal, "INTRADAY_ONLY_WRONG_TRADING_DAY")
        if now.time() >= self.policy.entry_cutoff_utc:
            return self._reject(signal, "ENTRY_CUTOFF_REACHED")
        if quote.symbol != signal.symbol or quote.bid <= 0 or quote.ask < quote.bid:
            return self._reject(signal, "INVALID_OR_MISMATCHED_QUOTE")
        age = (now - quote.observed_at).total_seconds()
        if age < 0 or age > self.policy.quote_max_age_seconds:
            return self._reject(signal, "STALE_OR_FUTURE_QUOTE")
        spread = quote.ask - quote.bid
        if spread > self.policy.max_spread:
            return self._reject(signal, "SPREAD_LIMIT_EXCEEDED")
        if self.entry_locked:
            return self._reject(signal, self.lock_reason or "ENTRY_LOCKED")
        if self.daily_pnl() <= -self.policy.max_daily_loss:
            self.entry_locked, self.lock_reason = True, "DAILY_LOSS_LIMIT"
            return self._reject(signal, "DAILY_LOSS_LIMIT")
        if self.daily_pnl() >= self.policy.daily_profit_target:
            self.entry_locked, self.lock_reason = True, "DAILY_PROFIT_TARGET"
            return self._reject(signal, "DAILY_PROFIT_TARGET")
        if sum(1 for p in self.positions.values() if p.is_open) >= self.policy.max_open_positions:
            return self._reject(signal, "MAX_OPEN_POSITIONS")
        fill = quote.ask if signal.side is Side.BUY else quote.bid
        if abs(fill - signal.expected_entry) > self.policy.max_entry_deviation:
            return self._reject(signal, "ENTRY_DEVIATION_EXCEEDED")
        if signal.side is Side.BUY and not (signal.stop_loss < fill < signal.take_profit):
            return self._reject(signal, "INVALID_BUY_PROTECTION_LEVELS")
        if signal.side is Side.SELL and not (signal.take_profit < fill < signal.stop_loss):
            return self._reject(signal, "INVALID_SELL_PROTECTION_LEVELS")
        risk = abs(fill - signal.stop_loss) * signal.quantity * signal.value_per_price_unit
        if risk > self.policy.max_trade_risk:
            return self._reject(signal, "PER_TRADE_RISK_LIMIT")
        if self.aggregate_open_risk() + risk > self.policy.max_aggregate_risk:
            return self._reject(signal, "AGGREGATE_OPEN_RISK_LIMIT")
        position_id = hashlib.sha256(f"{signal.signal_id}:{signal.idempotency_key}".encode()).hexdigest()[:24]
        position = PaperPosition(position_id, signal.signal_id, signal.symbol, signal.side,
                                 signal.quantity, fill, signal.stop_loss, signal.take_profit,
                                 signal.value_per_price_unit, risk, now, self.trading_day.isoformat(), fill)
        self.positions[position_id] = position
        result = PaperResult(ResultCode.PAPER_SIMULATED, signal.signal_id, "PAPER_FILL_ONLY_NO_BROKER_IO", fill, position_id, risk)
        self.results[signal.signal_id] = result
        self._idempotency[signal.idempotency_key] = (fingerprint, signal.signal_id)
        return result

    def mark(self, symbol: str, price: Decimal, *, now: datetime) -> list[str]:
        """Update paper marks and simulate protective exits when a level is crossed."""
        if not self._utc(now) or price <= 0:
            raise ValueError("A positive price and UTC timestamp are required")
        if now.date() != self.trading_day:
            raise ValueError("Paper marks must remain within the configured trading day")
        closed: list[str] = []
        for position in self.positions.values():
            if not position.is_open or position.symbol != symbol:
                continue
            position.mark_price = price
            hit_stop = price <= position.stop_loss if position.side is Side.BUY else price >= position.stop_loss
            hit_target = price >= position.take_profit if position.side is Side.BUY else price <= position.take_profit
            if hit_stop or hit_target:
                self.close_position(position.position_id, price=position.stop_loss if hit_stop else position.take_profit,
                                    now=now, reason="STOP_LOSS" if hit_stop else "TAKE_PROFIT")
                closed.append(position.position_id)
        self._apply_daily_locks()
        return closed

    def close_position(self, position_id: str, *, price: Decimal, now: datetime, reason: str) -> PaperPosition:
        if not self._utc(now) or price <= 0:
            raise ValueError("A positive close price and UTC timestamp are required")
        if now.date() != self.trading_day:
            raise ValueError("Paper close must remain within the configured trading day")
        position = self.positions[position_id]
        if not position.is_open:
            return position
        position.mark_price = price
        position.realized_pnl = position.unrealized_pnl()
        position.closed_at = now
        position.close_reason = reason
        self._apply_daily_locks()
        return position

    def close_all(self, marks: Mapping[str, Decimal], *, now: datetime, reason: str = "END_OF_DAY") -> list[str]:
        """Flatten the paper book only when an explicit mark is supplied per symbol."""
        if not self._utc(now):
            raise ValueError("UTC timestamp required")
        if now.date() != self.trading_day:
            raise ValueError("End-of-day flatten must occur on the configured trading day")
        required_symbols = {p.symbol for p in self.positions.values() if p.is_open}
        missing_symbols = required_symbols.difference(marks.keys())
        if missing_symbols:
            raise ValueError(f"Missing close marks for: {', '.join(sorted(missing_symbols))}")
        closed: list[str] = []
        for position in self.positions.values():
            if position.is_open:
                self.close_position(position.position_id, price=marks[position.symbol], now=now, reason=reason)
                closed.append(position.position_id)
        return closed

    def flatten_deadline_missed(self, *, now: datetime) -> bool:
        """Report an operational breach; this method does not invent a close price."""
        if not self._utc(now) or now.date() != self.trading_day:
            raise ValueError("UTC timestamp on the configured trading day required")
        return now.time() >= self.policy.flatten_deadline_utc and any(p.is_open for p in self.positions.values())

    def _apply_daily_locks(self) -> None:
        pnl = self.daily_pnl()
        if pnl <= -self.policy.max_daily_loss:
            self.entry_locked, self.lock_reason = True, "DAILY_LOSS_LIMIT"
        elif pnl >= self.policy.daily_profit_target:
            self.entry_locked, self.lock_reason = True, "DAILY_PROFIT_TARGET"

    def start_next_day(self, next_day: date, *, new_starting_equity: Decimal) -> None:
        if any(position.is_open for position in self.positions.values()):
            raise RuntimeError("Cannot roll trading day while paper positions remain open")
        if next_day <= self.trading_day or new_starting_equity <= 0:
            raise ValueError("Next day and starting equity must advance")
        self.trading_day = next_day
        self.starting_equity = new_starting_equity
        self.positions.clear()
        self.results.clear()
        self._idempotency.clear()
        self.entry_locked = False
        self.lock_reason = None
