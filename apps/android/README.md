# Android Client Status

**Current state: authenticated research chat implementation on a feature branch; production readiness is not established.**

## Implemented in source

- Supabase email/password sign-in through the HTTPS Auth REST endpoint.
- User access token is held in application memory only; it is not persisted to disk. The user must sign in again after restarting the app.
- Sign-out calls Supabase Auth and clears the local in-memory session even if the remote sign-out cannot be confirmed.
- NOVA AI chat sends bounded user/assistant messages to the fixed Worker endpoint using the current user's bearer token.
- Responses are rendered as plain text. Model-supplied HTML or scripts are never evaluated.
- No order, broker-write, deposit, withdrawal, or transfer API is implemented.

## Configuration

- `NOVA_AI_API_BASE_URL` points to the public NOVA AI Worker HTTPS endpoint.
- `SUPABASE_URL` and the Supabase publishable client key are public client configuration, not service-role credentials.
- Never add Supabase service-role keys, database credentials, broker credentials, tenant secrets, or other privileged values to Gradle files, source code, or the APK.

## Current limitations

- Market Feed is not connected.
- MT5 Bridge status is not connected or verified.
- The Android chat does not persist conversation history across app restarts.
- NOVA AI chat is research/information only. It is not a candle-analysis API and must not be represented as broker-verified market analysis.

## Build status

No Gradle Wrapper is committed yet. The GitHub Actions workflow installs a pinned Gradle version for a debug-only build. A successful build of the latest updated source and a matching APK artifact are not yet confirmed. Do not sign, install, distribute, or release an APK without separate approval.

## Safety

- Live Trading remains OFF.
- No order submission or broker write operations.
- No deposits, withdrawals, or transfers.
- No signing, deployment, publishing, or production release.
