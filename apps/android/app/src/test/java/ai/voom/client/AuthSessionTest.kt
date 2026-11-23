package ai.voom.client

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthSessionTest {
    @Test
    fun sessionDoesNotRefreshWhenExpiryIsOutsideSafetyWindow() {
        val session = AuthSession(
            accessToken = "access",
            refreshToken = "refresh",
            expiresAtEpochSeconds = 1_000L
        )

        assertFalse(session.shouldRefresh(nowEpochSeconds = 900L))
    }

    @Test
    fun sessionRefreshesInsideDefaultSixtySecondSafetyWindow() {
        val session = AuthSession(
            accessToken = "access",
            refreshToken = "refresh",
            expiresAtEpochSeconds = 1_000L
        )

        assertTrue(session.shouldRefresh(nowEpochSeconds = 940L))
    }

    @Test
    fun sessionRefreshesWhenAlreadyExpired() {
        val session = AuthSession(
            accessToken = "access",
            refreshToken = "refresh",
            expiresAtEpochSeconds = 1_000L
        )

        assertTrue(session.shouldRefresh(nowEpochSeconds = 1_001L))
    }

    @Test
    fun zeroSkewRefreshesOnlyAtOrAfterExpiry() {
        val session = AuthSession(
            accessToken = "access",
            refreshToken = "refresh",
            expiresAtEpochSeconds = 1_000L
        )

        assertFalse(session.shouldRefresh(nowEpochSeconds = 999L, refreshSkewSeconds = 0L))
        assertTrue(session.shouldRefresh(nowEpochSeconds = 1_000L, refreshSkewSeconds = 0L))
    }
}
