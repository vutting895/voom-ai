# VOOM AI — POWERED BY NOVA

Client platform for Android and responsive web, integrated with the authenticated NOVA AI research worker.

## Product scope

- Native Android client using Kotlin and Jetpack Compose.
- Responsive web client using React, TypeScript, and Vite.
- Thai / English UI.
- Navy + Electric Blue design system.
- Supabase email/password authentication with user-scoped access tokens.
- Authenticated NOVA AI research chat through `POST /api/chat`.
- Market and MT5 status remain unverified until a real, owner-scoped data source confirms them.

## Architecture

- NOVA AI Worker: `https://voom-system-nova-ai.suwapat787.workers.dev`.
- Worker route: `POST /api/chat`; accepts bounded user/assistant messages and requires a Supabase bearer token.
- Web: same-origin `/api/chat` is proxied by a fixed Netlify Edge Function. Local Vite development uses a fixed proxy to the same Worker.
- Android: calls the fixed NOVA AI Worker HTTPS endpoint directly.
- Supabase URL and publishable client key are public client configuration. Service-role keys and privileged secrets remain server-side.
- Android access tokens are held in memory only and are not persisted to disk.

## Safety boundaries

- Live Trading is OFF.
- No order submission, broker write operations, deposits, withdrawals, or transfers.
- The AI Worker is informational/research-only and exposes no order/execution tool.
- Never represent client-provided data as broker-verified.
- Market Feed and MT5 Bridge remain Not verified until backed by an authenticated, owner-scoped source.
- Never expose Supabase service-role keys, broker credentials, tenant secrets, or other server secrets in client code.

## Development and CI policy

- Zero-cost strict: no paid services or billing activation without explicit approval.
- GitHub Actions CI is verification-only; no signing, deployment, publishing, or production release.
- Android CI is debug-only, with no signing or release APK.
- Keep CI frequency and artifact retention bounded; monitor included usage and do not exceed account allowances.
- No Base44 runtime.
- Build, signing, installation, deployment, merge, and production release remain separate gates requiring explicit approval.

## Repository status

Application source code is developed on feature branches and reviewed through pull requests. Main is the source of truth. Do not merge until required verification and manual review gates pass.

## NOVA Core read-only integration

- Web reads the authenticated NOVA System Integration Hub registry and the signed-in user's own connection list through a fixed Netlify Edge proxy at `/api/core/*`.
- Android calls the fixed Hub HTTPS origin directly with the current Supabase user access token.
- Only `GET /v1/integrations` and `GET /v1/connections` are exposed in this client slice. No connection creation, credential intake, account mutation, market-data write, or trading endpoint is available.
- The clients reject responses unless `ordersEnabled=false` and `liveTradingEnabled=false`; connection records remain unverified unless the Hub reports `dataVerified=true`.
- Runtime integration remains gated on confirming the deployed Hub uses the canonical VOOM/NOVA Supabase project and testing a real authenticated account. A source-level client implementation is not proof of production connectivity.
