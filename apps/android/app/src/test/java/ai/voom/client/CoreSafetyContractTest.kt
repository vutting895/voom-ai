package ai.voom.client

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class CoreSafetyContractTest {
    @Test
    fun acceptsExplicitReadOnlyConnection() {
        val item = JSONObject()
            .put("ordersEnabled", false)
            .put("liveTradingEnabled", false)
            .put("executionEnabled", false)
            .put("provider", "exness_mt5")
            .put("environment", "demo")
            .put("readiness", "pending")
        assertEquals(
            "exness_mt5 · demo · pending · data not verified",
            CoreSafetyContract.connectionSummary(item)
        )
    }

    @Test
    fun rejectsConnectionWhenExecutionIsEnabled() {
        val item = JSONObject()
            .put("ordersEnabled", false)
            .put("liveTradingEnabled", false)
            .put("executionEnabled", true)
        assertThrows(IllegalArgumentException::class.java) {
            CoreSafetyContract.connectionSummary(item)
        }
    }

    @Test
    fun rejectsConnectionWhenExecutionFlagIsMissingOnlyIfOtherFlagsMissing() {
        val item = JSONObject()
            .put("ordersEnabled", false)
            .put("liveTradingEnabled", false)
        // Older read-only Hub responses may omit executionEnabled; the two
        // mandatory deny flags still have to be explicit.
        assertEquals(
            "unknown · unknown · unknown · data not verified",
            CoreSafetyContract.connectionSummary(item)
        )
    }

    @Test
    fun rejectsMissingOrdersFlag() {
        val item = JSONObject().put("liveTradingEnabled", false)
        assertThrows(IllegalArgumentException::class.java) {
            CoreSafetyContract.requireReadOnly(item, "connection")
        }
    }

    @Test
    fun rejectsLiveTradingEnabled() {
        val item = JSONObject()
            .put("ordersEnabled", false)
            .put("liveTradingEnabled", true)
        assertThrows(IllegalArgumentException::class.java) {
            CoreSafetyContract.requireReadOnly(item, "connection")
        }
    }
}
