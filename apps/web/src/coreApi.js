const CORE_PATHS = Object.freeze({
  integrations: "/api/core/v1/integrations",
  connections: "/api/core/v1/connections",
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertReadOnly(payload) {
  if (payload.ordersEnabled !== false || payload.liveTradingEnabled !== false) {
    throw new Error("NOVA Core safety flags are missing or unsafe");
  }
  if ("executionEnabled" in payload && payload.executionEnabled !== false) {
    throw new Error("NOVA Core execution flag is missing or unsafe");
  }
}

async function getJson(path, accessToken, fetchImpl = fetch) {
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("Sign in before checking NOVA Core");
  }
  const response = await fetchImpl(path, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`NOVA Core returned invalid JSON (HTTP ${response.status})`);
  }
  if (!isRecord(payload)) throw new Error("NOVA Core returned an invalid response shape");
  if (!response.ok) {
    const code = typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`;
    throw new Error(`NOVA Core rejected the request: ${code}`);
  }
  assertReadOnly(payload);
  return payload;
}

export async function fetchCoreSnapshot(accessToken, fetchImpl = fetch) {
  const [registry, connectionList] = await Promise.all([
    getJson(CORE_PATHS.integrations, accessToken, fetchImpl),
    getJson(CORE_PATHS.connections, accessToken, fetchImpl),
  ]);
  if (!Array.isArray(registry.integrations) || !Array.isArray(connectionList.connections)) {
    throw new Error("NOVA Core response is missing integration or connection records");
  }
  return {
    integrations: registry.integrations.filter(isRecord),
    connections: connectionList.connections.filter(isRecord),
    mode: typeof registry.mode === "string" ? registry.mode : "unknown",
  };
}
