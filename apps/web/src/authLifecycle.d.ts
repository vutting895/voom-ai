export type AuthSnapshot = {
  generation: number;
  userId: string | null;
};

export class AuthLifecycle {
  snapshot(): AuthSnapshot;
  setUserId(userId: string | null): boolean;
  signOut(): AuthSnapshot;
  invalidate(): void;
  isCurrent(snapshot: AuthSnapshot): boolean;
}
