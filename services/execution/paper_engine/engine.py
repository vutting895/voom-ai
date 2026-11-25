"""Deterministic PAPER-only execution simulator; intentionally has no broker I/O."""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Mapping

from .models import (PaperPolicy, PaperPosition, PaperQuote, PaperResult,
                     PaperSignal, ResultCode, Side)
from services.risk_engine import RiskEngine, RiskInput, RiskPolicy, RiskSide
from .store import SQLitePaperStore


class PaperExecutionEngine:
    """In-memory paper ledger. It cannot connect to or submit to a broker."""

    MODE = "PAPER"

    def __init__(self, *, starting_equity: Decimal, policy: PaperPolicy, trading_day: date, store: SQLitePaperStore | None = None):
        if starting_equity <= 0:
            raise ValueError("starting_equity must be positive")
        self.starting_equity = starting_equity
        self.policy = policy
        self.risk_engine = RiskEngine(RiskPolicy(
            max_trade_risk=policy.max_trade_risk,
            max_aggregate_risk=policy.max_aggregate_risk,
            max_daily_loss=policy.max_daily_loss,
            daily_profit_target=policy.daily_profit_target,
            max_open_positions=policy.max_open_positions,
            max_spread=policy.max_spread,
            max_entry_deviation=policy.max_entry_deviation,
        ))
        self.trading_day = trading_day
        self.positions: dict[str, PaperPosition] = {}
        self.results: dict[str, PaperResult] = {}
        self._idempotency: dict[str, tuple[str, str]] = {}
        self.entry_locked = False
        self.lock_reason: str | None = None
        self.store = store
        self._storage_failed = False
        if self.store is not None:
            saved = self.store.load_snapshot()
            if saved is not None:
                self._restore_snapshot(saved)

    def _configuration_fingerprint(self) -> str:
        policy_data = {key: str(value) for key, value in vars(self.policy).items()}
        payload = {"starting_equity": str(self.starting_equity),
                   "trading_day": self.trading_day.isoformat(), "policy": policy_data}
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

    def _snapshot(self) -> dict:
        positions = []
        for position in self.positions.values():
            positions.append({
                "position_id": position.position_id, "signal_id": position.signal_id,
                "symbol": position.symbol, "side": position.side.value,
                "quantity": str(position.quantity), "entry_price": str(position.entry_price),
                "stop_loss": str(position.stop_loss), "take_profit": str(position.take_profit),
                "value_per_price_unit": str(position.value_per_price_unit),
                "risk_amount": str(position.risk_amount), "opened_at": position.opened_at.isoformat(),
                "trading_day": position.trading_day, "mark_price": str(position.mark_price),
                "realized_pnl": str(position.realized_pnl),
                "closed_at": position.closed_at.isoformat() if position.closed_at else None,
                "close_reason": position.close_reason,
            })
        results = {key: {"code": value.code.value, "intent_id": value.intent_id,
                         "reason": value.reason,
                         "fill_price": str(value.fill_price) if value.fill_price is not None else None,
                         "position_id": value.position_id,
                         "risk_amount": str(value.risk_amount) if value.risk_amount is not None else None}
                   for key, value in self.results.items()}
        return {
            "configuration_fingerprint": self._configuration_fingerprint(),
            "trading_day": self.trading_day.isoformat(),
            "starting_equity": str(self.starting_equity),
            "positions": positions, "results": results,
            "idempotency": {key: list(value) for key, value in self._idempotency.items()},
            "entry_locked": self.entry_locked, "lock_reason": self.lock_reason,
        }

    def _restore_snapshot(self, saved: dict) -> None:
        if saved.get("configuration_fingerprint") != self._configuration_fingerprint():
            raise ValueError("Stored PAPER state does not match the supplied trading day, equity or policy")
        restored = {}
        for item in saved.get("positions", []):
            position = PaperPosition(
                item["position_id"], item["signal_id"], item["symbol"], Side(item["side"]),
                Decimal(item["quantity"]), Decimal(item["entry_price"]), Decimal(item["stop_loss"]),
                Decimal(item["take_profit"]), Decimal(item["value_per_price_unit"]),
                Decimal(item["risk_amount"]), datetime.fromisoformat(item["opened_at"]),
                item["trading_day"], Decimal(item["mark_price"]), Decimal(item["realized_pnl"]),
                datetime.fromisoformat(item["closed_at"]) if item.get("closed_at") else None,
                item.get("close_reason"),
            )
            restored[position.position_id] = position
        self.positions = restored
        self.results = {key: PaperResult(
            ResultCode(value["code"]), value["intent_id"], value["reason"],
            Decimal(value["fill_price"]) if value.get("fill_price") is not None else None,
            value.get("position_id"),
            Decimal(value["risk_amount"]) if value.get("risk_amount") is not None else None,
        ) for key, value in saved.get("results", {}).items()}
        self._idempotency = {key: (value[0], value[1])
                             for key, value in saved.get("idempotency", {}).items()}
        self.entry_locked = bool(saved.get("entry_locked", False))
        self.lock_reason = saved.get("lock_reason")

    def _persist(self, event_type: str, event: dict, occurred_at: datetime) -> None:
        if self.store is None:
            return
        if self._storage_failed:
            raise RuntimeError("PAPER storage is in failed-stop state; recreate engine from durable state")
        try:
            self.store.save_snapshot(self._snapshot(), event_type=event_type,
                                     event=event, occurred_at=occurred_at.isoformat())
        except Exception:
            self._storage_failed = True
            raise

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
        event_time = signal.created_at if self._utc(signal.created_at) else datetime.now(timezone.utc)
        self._persist("SIGNAL_REJECTED", {"signal_id": signal.signal_id, "reason": reason}, event_time)
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
        decision = self.risk_engine.evaluate_entry(RiskInput(
            side=RiskSide(signal.side.value), bid=quote.bid, ask=quote.ask,
            expected_entry=signal.expected_entry, stop_loss=signal.stop_loss,
            take_profit=signal.take_profit, quantity=signal.quantity,
            value_per_price_unit=signal.value_per_price_unit,
            current_open_risk=self.aggregate_open_risk(),
            open_positions=sum(1 for p in self.positions.values() if p.is_open),
            daily_pnl=self.daily_pnl(), entry_locked=self.entry_locked,
        ))
        if not decision.allowed:
            if decision.reason_code in ("DAILY_LOSS_LIMIT", "DAILY_PROFIT_TARGET"):
                self.entry_locked, self.lock_reason = True, decision.reason_code
            return self._reject(signal, decision.reason_code)
        fill = decision.fill_price
        risk = decision.risk_amount
        position_id = hashlib.sha256(f"{signal.signal_id}:{signal.idempotency_key}".encode()).hexdigest()[:24]
        position = PaperPosition(position_id, signal.signal_id, signal.symbol, signal.side,
                                 signal.quantity, fill, signal.stop_loss, signal.take_profit,
                                 signal.value_per_price_unit, risk, now, self.trading_day.isoformat(), fill)
        self.positions[position_id] = position
        result = PaperResult(ResultCode.PAPER_SIMULATED, signal.signal_id, "PAPER_FILL_ONLY_NO_BROKER_IO", fill, position_id, risk)
        self.results[signal.signal_id] = result
        self._idempotency[signal.idempotency_key] = (fingerprint, signal.signal_id)
        self._persist("PAPER_POSITION_OPENED", {"signal_id": signal.signal_id,
                      "position_id": position_id, "symbol": signal.symbol,
                      "fill_price": str(fill), "risk_amount": str(risk)}, now)
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
        self._persist("PAPER_MARK_UPDATED", {"symbol": symbol, "price": str(price),
                      "closed_position_ids": closed}, now)
        return closed

    def close_position(self, position_id: str, *, price: Decimal, now: datetime, reason: str, _persist_state: bool = True) -> PaperPosition:
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
        if _persist_state:
            self._persist("PAPER_POSITION_CLOSED", {"position_id": position_id,
                          "price": str(price), "reason": reason,
                          "realized_pnl": str(position.realized_pnl)}, now)
        return position

    def close_all(self, marks: Mapping[str, Decimal], *, now: datetime, reason: str = "END_OF_DAY") -> list[str]:
        """Flatten the paper book only when an explicit mark is supplied per symbol."""
        if not self._utc(now):
            raise ValueError("UTC timestamp required")
        if now.date() != self.trading_day:
            raise ValueError("End-of-day flatten must occur on the configured trading day")
        required_symbols = {p.symbol for p in self.positions.values() if p.is_open}
        missing_symbols = required_symbols.difference(marks.keys())
        if any(price <= 0 for price in marks.values()):
            raise ValueError("All end-of-day marks must be positive")
        if missing_symbols:
            raise ValueError(f"Missing close marks for: {', '.join(sorted(missing_symbols))}")
        closed: list[str] = []
        for position in self.positions.values():
            if position.is_open:
                self.close_position(position.position_id, price=marks[position.symbol], now=now,
                                    reason=reason, _persist_state=False)
                closed.append(position.position_id)
        if closed:
            self._persist("PAPER_BOOK_FLATTENED", {"position_ids": closed,
                          "reason": reason, "marks": {key: str(value) for key, value in marks.items()}}, now)
        return closed

    def flatten_deadline_missed(self, *, now: datetime) -> bool:
        """Report an operational breach; this method does not invent a close price."""
        if not self._utc(now) or now.date() != self.trading_day:
            raise ValueError("UTC timestamp on the configured trading day required")
        return now.time() >= self.policy.flatten_deadline_utc and any(p.is_open for p in self.positions.values())

    def _apply_daily_locks(self) -> None:
        lock_reason = self.risk_engine.daily_lock_reason(self.daily_pnl())
        if lock_reason:
            self.entry_locked, self.lock_reason = True, lock_reason

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
        self._persist("PAPER_TRADING_DAY_ROLLED", {"trading_day": next_day.isoformat(),
                      "starting_equity": str(new_starting_equity)},
                      datetime.combine(next_day, datetime.min.time(), tzinfo=timezone.utc))
