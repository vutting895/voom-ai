import test from "node:test";
import assert from "node:assert/strict";
import { fetchCoreSnapshot } from "../src/coreApi.js";

const registry = {
  service: "voom-system-hub",
  integrations: [{ id: "nova-ai", configured: true }],
  mode: "read-only",
  ordersEnabled: false,
  liveTradingEnabled: false,
  executionEnabled: false,
};
const connections = {
  connections: [{
    connectionId: "11111111-1111-4111-8111-111111111111",
    provider: "exness_mt5",
    environment: "demo",
    recordStatus: "pending",
    readiness: "pending_provisioning",
    dataVerified: false,
    ordersEnabled: false,
    liveTradingEnabled: false,
  executionEnabled: false,
  }],
  count: 1,
  ordersEnabled: false,
  liveTradingEnabled: false,
  executionEnabled: false,
};

test("fetches only authenticated registry and owner-scoped connection routes", async () => {
  const calls = [];
  const result = await fetchCoreSnapshot("user-token", async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(url.endsWith("/integrations") ? registry : connections), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  assert.deepEqual(calls.map(call => call.url).sort(), [
    "/api/core/v1/connections",
    "/api/core/v1/integrations",
  ]);
  assert.ok(calls.every(call => call.init.method === "GET"));
  assert.ok(calls.every(call => call.init.headers.Authorization === "Bearer user-token"));
  assert.equal(result.connections[0].dataVerified, false);
});

test("accepts an authenticated empty connection list as an empty state, not an API failure", async () => {
  const result = await fetchCoreSnapshot("user-token", async url => new Response(
    JSON.stringify(url.endsWith("/integrations") ? registry : {
      connections: [],
      count: 0,
      ordersEnabled: false,
      liveTradingEnabled: false,
  executionEnabled: false,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  ));
  assert.equal(result.integrations.length, 1);
  assert.equal(result.connections.length, 0);
  assert.equal(result.mode, "read-only");
});

test("rejects missing access token", async () => {
  await assert.rejects(() => fetchCoreSnapshot(""), /Sign in/);
});

test("fails closed when the Hub omits or enables a trading safety flag", async () => {
  await assert.rejects(() => fetchCoreSnapshot("user-token", async () => new Response(
    JSON.stringify({ ...registry, ordersEnabled: true }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )), /safety flags/);
});

test("rejects a connection record that does not confirm read-only flags", async () => {
  await assert.rejects(() => fetchCoreSnapshot("user-token", async url => new Response(
    JSON.stringify(url.endsWith("/integrations") ? registry : {
      connections: [{ ...connections.connections[0], ordersEnabled: true }],
      ordersEnabled: false,
      liveTradingEnabled: false,
  executionEnabled: false,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )), /connection did not confirm read-only/);
});

test("rejects malformed response and never treats non-verified data as connected", async () => {
  await assert.rejects(() => fetchCoreSnapshot("user-token", async url => new Response(
    JSON.stringify(url.endsWith("/integrations") ? registry : { connections: "not-an-array", ordersEnabled: false, liveTradingEnabled: false }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )), /safety flags/);
});

test("fails closed when the Hub omits the execution safety flag", async () => {
  await assert.rejects(() => fetchCoreSnapshot("user-token", async url => {
    const payload = structuredClone(url.endsWith("/integrations") ? registry : connections);
    delete payload.executionEnabled;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }), /safety flags/);
});

test("fails closed when an individual connection enables execution", async () => {
  await assert.rejects(() => fetchCoreSnapshot("user-token", async url => {
    const payload = structuredClone(url.endsWith("/integrations") ? registry : connections);
    if (payload.connections?.[0]) payload.connections[0].executionEnabled = true;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }), /connection did not confirm read-only/);
});
