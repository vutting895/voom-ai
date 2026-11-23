package ai.voom.client

/**
 * In-memory Supabase session data. Do not persist these values without an
 * explicitly reviewed encrypted-storage design.
 */
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

    fun shouldRefresh(
        nowEpochSeconds: Long,
        refreshSkewSeconds: Long = DEFAULT_REFRESH_SKEW_SECONDS
    ): Boolean {
        require(refreshSkewSeconds >= 0) { "Refresh skew cannot be negative" }
        return expiresAtEpochSeconds <= nowEpochSeconds + refreshSkewSeconds
    }

    companion object {
        const val DEFAULT_REFRESH_SKEW_SECONDS = 60L
    }
}
