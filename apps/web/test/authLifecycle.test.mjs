import test from "node:test";
import assert from "node:assert/strict";
import { AuthLifecycle } from "../src/authLifecycle.js";

test("same-user token refresh does not invalidate in-flight user work", () => {
  const auth = new AuthLifecycle();
  auth.setUserId("user-a");
  const request = auth.snapshot();

  assert.equal(auth.setUserId("user-a"), false);
  assert.equal(auth.isCurrent(request), true);
});

test("switching accounts invalidates callbacks from the previous user", () => {
  const auth = new AuthLifecycle();
  auth.setUserId("user-a");
  const previousRequest = auth.snapshot();

  assert.equal(auth.setUserId("user-b"), true);
  assert.equal(auth.isCurrent(previousRequest), false);
  assert.equal(auth.isCurrent(auth.snapshot()), true);
});

test("sign-out invalidates pending requests and clears the identity", () => {
  const auth = new AuthLifecycle();
  auth.setUserId("user-a");
  const pendingRequest = auth.snapshot();

  const signOut = auth.signOut();
  assert.equal(auth.isCurrent(pendingRequest), false);
  assert.equal(signOut.userId, null);
  assert.equal(auth.isCurrent(signOut), true);
});

test("late sign-out completion cannot invalidate a newer sign-in", () => {
  const auth = new AuthLifecycle();
  auth.setUserId("user-a");
  const signOutRequest = auth.signOut();

  auth.setUserId("user-b");
  assert.equal(auth.isCurrent(signOutRequest), false);
  assert.equal(auth.snapshot().userId, "user-b");
});

test("component cleanup invalidates pending callbacks", () => {
  const auth = new AuthLifecycle();
  auth.setUserId("user-a");
  const pendingRequest = auth.snapshot();

  auth.invalidate();
  assert.equal(auth.isCurrent(pendingRequest), false);
});
