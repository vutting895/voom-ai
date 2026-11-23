const HUB_ORIGIN = "https://voom-system-hub.suwapat787.workers.dev";
const MAX_RESPONSE_BYTES = 32 * 1024;
const TIMEOUT_MS = 10_000;
const ALLOWED_PATHS = new Set(["/v1/integrations", "/v1/connections"]);

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function readBounded(stream: ReadableStream<Uint8Array> | null): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return json({ error: "authentication_required" }, 401);
  }

  const incoming = new URL(request.url);
  if (incoming.search || incoming.hash) return json({ error: "query_not_allowed" }, 400);
  const path = incoming.pathname.slice("/api/core".length);
  if (!ALLOWED_PATHS.has(path)) return json({ error: "route_not_allowed" }, 404);

  try {
    const upstream = await fetch(new URL(path, HUB_ORIGIN), {
      method: "GET",
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const contentType = upstream.headers.get("Content-Type") ?? "";
    if ((upstream.status >= 300 && upstream.status < 400) ||
        !/^application\/json(?:\s*;|$)/i.test(contentType)) {
      await upstream.body?.cancel();
      return json({ error: "invalid_hub_response" }, 502);
    }

    let bytes: Uint8Array;
    try {
      bytes = await readBounded(upstream.body);
    } catch {
      return json({ error: "hub_response_too_large" }, 502);
    }
    let body: string;
    try {
      body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const parsed: unknown = JSON.parse(body);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_json_shape");
    } catch {
      return json({ error: "invalid_hub_json" }, 502);
    }
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "nova_core_unavailable" }, 502);
  }
}
