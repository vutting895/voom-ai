"""Legacy MT5 worker boundary — execution is permanently disabled here.

This module deliberately has no MetaTrader5 dependency, account login,
terminal initialization, order construction, or order submission.
"""
from __future__ import annotations


def execute_mt5_order(*_args: object, **_kwargs: object) -> bool:
    """Compatibility shim: refuse every execution request without side effects."""
    return False


if __name__ == "__main__":
    print("LIVE_EXECUTION_DISABLED: no broker connection or order was attempted.")
    raise SystemExit(2)
