package ai.voom.client

/**
 * Tracks the latest authentication operation so delayed callbacks cannot
 * overwrite state produced by a newer sign-in or sign-out request.
 */
internal class AuthOperationGate {
    private var operationId: Int = 0

    @Synchronized
    fun begin(): Int {
        operationId += 1
        return operationId
    }

    @Synchronized
    fun currentId(): Int = operationId

    @Synchronized
    fun isCurrent(candidate: Int): Boolean = candidate == operationId
}
