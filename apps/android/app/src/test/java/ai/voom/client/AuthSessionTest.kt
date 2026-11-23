package ai.voom.client

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthSessionTest {
    @Test fun newerAuthOperationInvalidatesOlderCallback() {
        val gate = AuthOperationGate()
        val first = gate.begin()
        val second = gate.begin()
        assertFalse(gate.isCurrent(first))
        assertTrue(gate.isCurrent(second))
    }

    @Test fun signOutOperationInvalidatesPendingRefreshCallback() {
        val gate = AuthOperationGate()
        val pendingRefresh = gate.begin()
        gate.begin() // sign-out starts a newer auth operation
        assertFalse(gate.isCurrent(pendingRefresh))
    }

    @Test fun signOutWithoutSessionInvalidatesPendingSignIn() {
        val gate = AuthOperationGate()
        val pendingSignIn = gate.begin()
        gate.begin() // local sign-out must invalidate even before a token exists
        assertFalse(gate.isCurrent(pendingSignIn))
    }

    @Test fun sessionOutsideSafetyWindowDoesNotRefresh() {
        assertFalse(AuthSession("a", "r", 1_000L).shouldRefresh(900L))
    }

    @Test fun sessionInsideSafetyWindowRefreshes() {
        assertTrue(AuthSession("a", "r", 1_000L).shouldRefresh(940L))
    }

    @Test fun expiredSessionRefreshes() {
        assertTrue(AuthSession("a", "r", 1_000L).shouldRefresh(1_001L))
    }

    @Test fun zeroSkewRefreshesAtExpiryBoundary() {
        val session = AuthSession("a", "r", 1_000L)
        assertFalse(session.shouldRefresh(999L, 0L))
        assertTrue(session.shouldRefresh(1_000L, 0L))
    }

    @Test fun parsesSupabaseExpiryAndRotatedRefreshToken() {
        val session = AuthSession.fromSupabaseResponse(
            JSONObject("""{"access_token":"new-access","refresh_token":"rotated-refresh","expires_in":3600}"""),
            10_000L
        )
        assertEquals("new-access", session.accessToken)
        assertEquals("rotated-refresh", session.refreshToken)
        assertEquals(13_600L, session.expiresAtEpochSeconds)
    }

    @Test fun absoluteExpiryTakesPrecedence() {
        val session = AuthSession.fromSupabaseResponse(
            JSONObject("""{"access_token":"a","refresh_token":"r","expires_in":3600,"expires_at":12345}"""),
            10_000L
        )
        assertEquals(12_345L, session.expiresAtEpochSeconds)
    }
}
