# Android Client Status

**Current state: UI foundation only.** Supabase Auth and NOVA Analysis API calls are not implemented. The disabled action in `MainActivity` is intentional.

## Configuration

The generated `BuildConfig` values for the NOVA API base URL, Supabase URL, and public Supabase key default to empty strings. Do not add service-role keys, database credentials, broker credentials, or other secrets to Gradle files, source code, or the APK.

Do not enable analysis until all of the following are implemented and reviewed:

1. Supabase user authentication with secure session handling and sign-out.
2. HTTPS requests to `POST /v1/analysis/candles` using the current user's access token.
3. Request/response validation, bounded request sizes, timeouts, and fail-closed error handling.
4. Explicit display that supplied OHLCV is client-provided and not broker-verified.
5. Tests proving there are no order, broker-write, deposit, withdrawal, or transfer capabilities.

## Build status

No Gradle Wrapper is committed yet. A reproducible Android build has not been verified. Use Android Studio with a compatible JDK/Android SDK for local verification; do not sign, install, or distribute an APK without separate approval.
