import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ExecutionSafetyTests(unittest.TestCase):
    def test_worker_refuses_execution_without_broker_dependency(self):
        source = (ROOT / "mt5_execution_worker.py").read_text(encoding="utf-8")
        for forbidden in (
            "MetaTrader5",
            "mt5.initialize",
            "mt5.login",
            "mt5.order_send",
            "TRADE_ACTION_DEAL",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, source)

    def test_legacy_worker_returns_false(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "sniper_worker", ROOT / "mt5_execution_worker.py"
        )
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertIs(module.execute_mt5_order("x", "y", "z", "XAUUSDm", "BUY", 0.01), False)

    def test_trade_route_is_fail_closed(self):
        source = (ROOT / "app/api/trade/route.ts").read_text(encoding="utf-8")
        self.assertIn("status: 503", source)
        self.assertIn("SNIPER_EXECUTION_DISABLED", source)
        self.assertNotIn("order_send", source)
        self.assertNotIn("createBitkubOrder", source)


if __name__ == "__main__":
    unittest.main()
