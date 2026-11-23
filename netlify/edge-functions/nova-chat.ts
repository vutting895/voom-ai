const UPSTREAM = "https://voom-system-nova-ai.suwapat787.workers.dev/api/chat";
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;
const UPSTREAM_TIMEOUT_MS = 16_000;

class BodyTooLargeError extends Error {
  constructor() {
    super("body_too_large");
    this.name = "BodyTooLargeError";
  }
}

async function readBounded(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

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

function validMessages(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const messages = (value as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 8) return false;

  let totalCharacters = 0;
  for (const message of messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) return false;
    const item = message as { role?: unknown; content?: unknown };
    if (item.role !== "user" && item.role !== "assistant") return false;
    if (typeof item.content !== "string" || !item.content.trim() || item.content.length > 1200) return false;
    totalCharacters += item.content.length;
  }
  return totalCharacters <= 8000;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  if (!/^Bearer\\s+\\S+$/i.test(authorization)) {
    return json({ error: "authentication_required" }, 401);
  }

  if (!/^application\\/json(?:\\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) {
    return json({ error: "content_type_must_be_application_json" }, 415);
  }

  const contentLength = request.headers.get("Content-Length");
  if (contentLength && /^\\d+$/.test(contentLength) && Number(contentLength) > MAX_REQUEST_BYTES) {
    return json({ error: "request_too_large" }, 413);
  }

  let bodyBytes: Uint8Array;
  try {
    bodyBytes = await readBounded(request.body, MAX_REQUEST_BYTES);
  } catch (error) {
    return error instanceof BodyTooLargeError
      ? json({ error: "request_too_large" }, 413)
      : json({ error: "invalid_request_body" }, 400);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!validMessages(parsed)) return json({ error: "invalid_messages" }, 400);

  try {
    // Fixed upstream only. Forward the user's bearer token; never accept a client URL.
    // No Origin header is forwarded: the upstream authenticates the user session.
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: bodyBytes,
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const responseType = upstream.headers.get("Content-Type") ?? "";
    if (!/^application\\/json(?:\\s*;|$)/i.test(responseType)) {
      return json({ error: "invalid_upstream_content_type" }, 502);
    }

    const responseLength = upstream.headers.get("Content-Length");
    if (responseLength && /^\\d+$/.test(responseLength) && Number(responseLength) > MAX_RESPONSE_BYTES) {
      await upstream.body?.cancel();
      return json({ error: "upstream_response_too_large" }, 502);
    }

    let responseBytes: Uint8Array;
    try {
      responseBytes = await readBounded(upstream.body, MAX_RESPONSE_BYTES);
    } catch {
      return json({ error: "upstream_response_too_large" }, 502);
    }

    return new Response(responseBytes, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "nova_ai_unavailable", executionEnabled: false, liveTradingEnabled: false }, 502);
  }
}
