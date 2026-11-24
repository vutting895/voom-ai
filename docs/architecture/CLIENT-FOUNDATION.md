# VOOM AI Client Architecture

## Architecture

This repository contains two independent clients:

- `apps/android`: Kotlin + Jetpack Compose.
- `apps/web`: React + TypeScript + Vite.

Both clients use Supabase Auth for user identity and the NOVA AI Worker for authenticated, research-only chat. They do not share UI runtime code.

## Verified API contract in NOVA source

The NOVA repository documents the following authenticated route:

- Method: `POST`
- Path: `/api/chat`
- Upstream: `https://voom-system-nova-ai.suwapat787.workers.dev`
- Authentication: `Authorization: Bearer <Supabase user access token>`
- Request: `{ "messages": [{ "role": "user" | "assistant", "content": "..." }] }`
- Limits: 1–8 messages, max 1,200 characters per message, 8,000 total characters, JSON body max 16 KB.
- Response: `message`, `provider`, `model`, `intent`, `executionEnabled:false`, `liveTradingEnabled:false`.

The worker rejects unknown routes and validates the Supabase bearer token through Supabase Auth. It does not accept system-role messages or provide an order/execution tool. This is a chat/research contract, not a candle-analysis endpoint.

## Client routing

### Web
- Browser calls only same-origin `POST /api/chat`.
- `netlify/edge-functions/nova-chat.ts` forwards the request to the fixed NOVA Worker URL.
- The proxy requires a Bearer token, accepts JSON only, enforces a 16 KB body limit, forwards no caller-selected upstream URL, and never logs tokens.
- Local Vite development uses a fixed proxy to the same Worker and removes the localhost Origin header. The upstream still authenticates the bearer token.
- Netlify routing/build configuration is in `netlify.toml`.

### Android
- Supabase email/password authentication uses the public publishable key and HTTPS.
- The access token remains in memory only; it is not written to SharedPreferences or files.
- Sign-out attempts to revoke the Supabase session and always clears the local token.
- Chat requests go to the fixed NOVA AI Worker HTTPS endpoint with the user bearer token.
- Messages are bounded to the worker contract and rendered as plain text.

## Trust boundaries

1. Supabase Auth issues user-scoped access tokens.
2. Each client sends the current user's access token to the NOVA AI Worker.
3. The Worker validates the session through Supabase Auth before processing chat.
4. AI output is untrusted content. Clients render it as text only; they do not evaluate HTML, JavaScript, or tool instructions.
5. Service-role keys, broker credentials, tenant secrets, and privileged values remain server-side.
6. Market Feed, account status, and MT5 Bridge status remain Not verified until an authenticated, owner-scoped data source confirms them.

## Current implementation status

- Web source includes Supabase email/password session handling and authenticated chat. Netlify Edge Function and Vite development proxy are implemented. Exact-head CI verification passed on commit `e19a1239aaaf9d290344b50409873ad2c9cd7ce4`: auth lifecycle tests, TypeScript typecheck, and production build all passed in run [45193369983](https://github.com/vutting895/voom-ai/actions/runs/45193369983). A deployed Netlify route and authenticated production request remain unverified.
- Android source includes Supabase sign-in, in-memory access-token handling, refresh-before-chat, sign-out, and NOVA AI chat. Exact-head CI verification passed in run [45193369983](https://github.com/vutting895/voom-ai/actions/runs/45193369983): unit tests, debug APK build, and artifact upload all passed. Physical-device installation, device QA, and authenticated runtime requests remain unverified.
- The verified integration boundary is the existing research chat Worker only. A dedicated NOVA Core `/v1/*` API is not connected by this client foundation.
- Neither client is approved for production use.
- No real-time market feed or MT5 Bridge data path is implemented in this client foundation.

## Safety invariants

- Live Trading remains OFF.
- No order submission, broker write, deposit, withdrawal, or transfer endpoint is implemented.
- No user-provided OHLCV is labelled broker-verified.
- Missing/invalid credentials fail closed.
- Chat output is informational/research-only and cannot grant execution authority.

## Development, CI, and release

- Zero-cost strict; no paid service or billing activation is authorized.
- GitHub Actions is verification-only; Android CI builds a debug APK only.
- CI usage must remain within existing account allowances.
- Local verification is preferred where practical.
- Build, signing, installation, deployment, merge, and production release remain separate gates requiring explicit approval.

## NOVA System Integration Hub client — staged implementation

The clients now have a read-only integration path to the existing NOVA System Integration Hub:

- Hub origin: `https://voom-system-hub.suwapat787.workers.dev`.
- Protected routes used: `GET /v1/integrations` and `GET /v1/connections`.
- Web route: same-origin `/api/core/v1/*`, proxied by `netlify/edge-functions/nova-core.ts` to a fixed Hub origin. The proxy allows only the two exact GET routes, forwards only the user's Bearer token, rejects query strings and redirects, applies a 10-second timeout, and caps response bodies at 32 KB.
- Android calls the same two Hub routes directly over HTTPS with the signed-in user's Supabase access token.
- Both clients fail closed unless the Hub responses explicitly report `ordersEnabled=false`, `executionEnabled=false`, and `liveTradingEnabled=false`. The UI distinguishes successful API authentication from verified broker data.
- This slice does not create connections, submit credentials, read balances, fetch quotes, access MT5 Bridge data, or expose order/execution routes.

### Runtime acceptance gate

The NOVA Hub source authenticates against its configured Supabase project. The VOOM AI client is configured for project `rovhmjeowracayicbqij`. Before treating this integration as operational, confirm that the deployed `voom-system-hub` Worker is configured for that same project, then test authenticated `GET /v1/integrations` and `GET /v1/connections` from both clients. Do not change the Hub's production bindings without a separate explicit approval. Until that check passes, runtime status is `NOT VERIFIED`.

The System Hub provider-registry endpoint `GET /v1/broker/providers` is not included here because its implementation is on a separate unmerged NOVA PR; this client uses only routes present on NOVA main.
