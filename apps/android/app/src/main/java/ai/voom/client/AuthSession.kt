package ai.voom.client

import org.json.JSONObject

/** In-memory Supabase session. Do not persist tokens without reviewed encrypted storage. */
data class AuthSession(
    val accessToken: String,
    val refreshToken: String,
    val expiresAtEpochSeconds: Long
) {
    init {
        require(accessToken.isNotBlank()) { "Access token must not be blank" }
        require(refreshToken.isNotBlank()) { "Refresh token must not be blank" }
        require(expiresAtEpochSeconds > 0) { "Session expiry must be a positive epoch timestamp" }
    }

    fun shouldRefresh(nowEpochSeconds: Long, refreshSkewSeconds: Long = DEFAULT_REFRESH_SKEW_SECONDS): Boolean {
        require(refreshSkewSeconds >= 0) { "Refresh skew cannot be negative" }
        return expiresAtEpochSeconds <= nowEpochSeconds + refreshSkewSeconds
    }

    companion object {
        const val DEFAULT_REFRESH_SKEW_SECONDS = 60L

        fun fromSupabaseResponse(json: JSONObject, nowEpochSeconds: Long): AuthSession {
            val expiresAt = json.optLong("expires_at", 0L).takeIf { it > 0L }
                ?: (nowEpochSeconds + json.optLong("expires_in", 0L))
            return AuthSession(
                accessToken = json.optString("access_token"),
                refreshToken = json.optString("refresh_token"),
                expiresAtEpochSeconds = expiresAt
            )
        }
    }
}
