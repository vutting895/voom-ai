package ai.voom.client

import org.json.JSONObject

/**
 * Validates the safety contract returned by NOVA Core before the UI can display
 * connection state. Missing flags are unsafe; an enabled execution flag is unsafe.
 */
internal object CoreSafetyContract {
    fun requireReadOnly(payload: JSONObject, label: String) {
        require(!payload.optBoolean("ordersEnabled", true)) {
            "$label did not confirm orders are disabled"
        }
        require(!payload.optBoolean("liveTradingEnabled", true)) {
            "$label did not confirm live trading is disabled"
        }
        require(!payload.optBoolean("executionEnabled", true)) {
            "$label did not confirm execution is disabled"
        }
    }

    fun connectionSummary(item: JSONObject): String {
        requireReadOnly(item, "A NOVA Core connection")
        return item.optString("provider", "unknown") + " · " +
            item.optString("environment", "unknown") + " · " +
            item.optString("readiness", "unknown") + " · " +
            (if (item.optBoolean("dataVerified", false)) "data verified" else "data not verified")
    }
}
