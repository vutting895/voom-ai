# Android Client Status

**Current state: UI foundation only.** The Android client does not yet implement Supabase user authentication or NOVA Analysis API requests. The Analysis screen is informational only; no trading capability is present.

## Configuration

- `NOVA_ANALYSIS_API_BASE_URL` is currently blank and must be configured before analysis can be enabled.
- `SUPABASE_URL` and the Supabase publishable client key are currently supplied as public client configuration in Gradle. Publishable keys are not service-role secrets.
- Never add Supabase service-role keys, database credentials, broker credentials, tenant secrets, or other privileged values to Gradle files, source code, or the APK.

## Required before enabling analysis

1. Supabase user authentication with secure session handling and sign-out.
2. HTTPS requests to `POST /v1/analysis/candles` using the current user's access token.
3. Request/response validation, bounded request sizes, timeouts, and fail-closed error handling.
4. Explicit display that supplied OHLCV is client-provided and not broker-verified.
5. Tests proving there are no order, broker-write, deposit, withdrawal, or transfer capabilities.

## Build status

No Gradle Wrapper is committed yet. The GitHub Actions workflow installs a pinned Gradle version for a debug-only build. A successful reproducible Android build and APK artifact are not currently confirmed. Do not sign, install, distribute, or release an APK without separate approval.

## Safety

- Live Trading remains OFF.
- No order submission or broker write operations.
- No deposits, withdrawals, or transfers.
- No signing, deployment, publishing, or production release.
