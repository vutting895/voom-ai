"""PAPER-only end-of-day safety controller; never sends broker close orders."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Mapping

from .paper_engine.engine import PaperExecutionEngine
from .paper_engine.models import PaperQuote, Side


class EODStatus(str, Enum):
    NOT_DUE = "NOT_DUE"
    NO_OPEN_POSITIONS = "NO_OPEN_POSITIONS"
    FLATTENED = "FLATTENED"
    BLOCKED_MISSING_QUOTE = "BLOCKED_MISSING_QUOTE"
    BLOCKED_STALE_QUOTE = "BLOCKED_STALE_QUOTE"
    BLOCKED_INVALID_QUOTE = "BLOCKED_INVALID_QUOTE"


@dataclass(frozen=True)
class EODResult:
    status: EODStatus
    closed_position_ids: tuple[str, ...] = ()
    blocked_symbols: tuple[str, ...] = ()
    reason: str = ""


class PaperEODController:
    """Checks deadline and quote quality, then closes only the in-memory PAPER ledger."""

    def run(
        self,
        engine: PaperExecutionEngine,
        quotes: Mapping[str, PaperQuote],
        *,
        now: datetime,
    ) -> EODResult:
        if engine.MODE != "PAPER":
            raise ValueError("EOD controller only accepts PAPER execution engines")
        if now.tzinfo is None or now.utcoffset() != timezone.utc.utcoffset(now):
            raise ValueError("UTC timestamp required")

        open_positions = {
            position_id: position
            for position_id, position in engine.positions.items()
            if position.is_open
        }
        if not open_positions:
            return EODResult(EODStatus.NO_OPEN_POSITIONS)
        if now.date() != engine.trading_day:
            raise ValueError("EOD controller must run on the configured trading day")
        if now.time() < engine.policy.flatten_deadline_utc:
            return EODResult(EODStatus.NOT_DUE)

        symbols = {position.symbol for position in open_positions.values()}
        missing = sorted(symbol for symbol in symbols if symbol not in quotes)
        if missing:
            return EODResult(
                EODStatus.BLOCKED_MISSING_QUOTE,
                blocked_symbols=tuple(missing),
                reason="No close quote supplied; positions remain open",
            )

        close_marks: dict[str, Decimal] = {}
        stale: set[str] = set()
        invalid: set[str] = set()
        for symbol in symbols:
            quote = quotes[symbol]
            if (not isinstance(quote, PaperQuote)
                    or quote.symbol != symbol
                    or not isinstance(quote.bid, Decimal)
                    or not isinstance(quote.ask, Decimal)
                    or not quote.bid.is_finite()
                    or not quote.ask.is_finite()
                    or quote.bid <= 0
                    or quote.ask < quote.bid
                    or quote.observed_at.tzinfo is None
                    or quote.observed_at.utcoffset() != timezone.utc.utcoffset(quote.observed_at)):
                invalid.add(symbol)
                continue
            age = (now - quote.observed_at).total_seconds()
            if age < 0 or age > engine.policy.quote_max_age_seconds:
                stale.add(symbol)
                continue
            for position_id, position in open_positions.items():
                if position.symbol == symbol:
                    close_marks[position_id] = (
                        quote.bid if position.side is Side.BUY else quote.ask
                    )

        if invalid:
            return EODResult(
                EODStatus.BLOCKED_INVALID_QUOTE,
                blocked_symbols=tuple(sorted(invalid)),
                reason="Malformed or mismatched quote; positions remain open",
            )
        if stale:
            return EODResult(
                EODStatus.BLOCKED_STALE_QUOTE,
                blocked_symbols=tuple(sorted(stale)),
                reason="Quote is stale or from the future; positions remain open",
            )

        closed = engine.close_positions(
            close_marks, now=now, reason="EOD_AUTOMATED_PAPER_FLATTEN"
        )
        return EODResult(
            EODStatus.FLATTENED,
            closed_position_ids=tuple(closed),
            reason="PAPER ledger closed using side-aware bid/ask marks; no broker order sent",
        )
