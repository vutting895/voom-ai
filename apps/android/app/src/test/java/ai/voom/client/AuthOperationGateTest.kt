package ai.voom.client

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthOperationGateTest {
    @Test
    fun newerOperationInvalidatesEarlierCallback() {
        val gate = AuthOperationGate()

        val signInOperation = gate.begin()
        val signOutOperation = gate.begin()

        assertFalse(gate.isCurrent(signInOperation))
        assertTrue(gate.isCurrent(signOutOperation))
    }

    @Test
    fun currentOperationRemainsValidUntilSuperseded() {
        val gate = AuthOperationGate()

        val operation = gate.begin()

        assertTrue(gate.isCurrent(operation))
        assertTrue(gate.isCurrent(gate.begin()).not())
    }

    @Test
    fun laterOperationInvalidatesSignOutCallbackToo() {
        val gate = AuthOperationGate()

        val signOutOperation = gate.begin()
        val laterSignInOperation = gate.begin()

        assertFalse(gate.isCurrent(signOutOperation))
        assertTrue(gate.isCurrent(laterSignInOperation))
    }
}
