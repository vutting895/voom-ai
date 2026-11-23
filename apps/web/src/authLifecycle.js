/**
 * Tracks the identity generation for asynchronous, user-scoped UI operations.
 * A snapshot becomes stale whenever the authenticated user changes or signs out.
 */
export class AuthLifecycle {
  #generation = 0;
  #userId = null;

  snapshot() {
    return { generation: this.#generation, userId: this.#userId };
  }

  setUserId(userId) {
    if (this.#userId === userId) return false;
    this.#userId = userId;
    this.#generation += 1;
    return true;
  }

  signOut() {
    this.#userId = null;
    this.#generation += 1;
    return this.snapshot();
  }

  invalidate() {
    this.#generation += 1;
  }

  isCurrent(snapshot) {
    return snapshot.generation === this.#generation &&
      snapshot.userId === this.#userId;
  }
}
