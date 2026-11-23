const UPSTREAM = "https://voom-system-nova-ai.suwapat787.workers.dev/api/chat";
const MAX_BODY_BYTES = 16 * 1024;

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

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return json({ error: "authentication_required" }, 401);
  }

  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) {
    return json({ error: "content_type_must_be_application_json" }, 415);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: "request_too_large" }, 413);

  let body: string;
  try {
    body = await request.text();
  } catch {
    return json({ error: "invalid_request_body" }, 400);
  }
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return json({ error: "request_too_large" }, 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
      || !Array.isArray((parsed as { messages?: unknown }).messages)) {
    return json({ error: "invalid_messages" }, 400);
  }

  try {
    // Fixed upstream only. Forward the user's bearer token; never accept a client URL.
    // No Origin header is forwarded: the upstream performs bearer authentication and
    // the proxy is server-to-server, so browser CORS is not the trust boundary.
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(16_000),
    });
    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "nova_ai_unavailable", executionEnabled: false, liveTradingEnabled: false }, 502);
  }
}

