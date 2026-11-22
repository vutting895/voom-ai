# VOOM AI Client Foundation

## Architecture decision

This repository is a monorepo with two independently built clients:

- `apps/android`: native Android application using Kotlin and Jetpack Compose.
- `apps/web`: responsive web application using React, TypeScript, and Vite.

The clients share the versioned API contract, product terminology, safety rules, and design tokens documented in this repository. They do not share UI runtime code.

## Trust boundaries

1. Supabase Auth issues user-scoped access tokens.
2. Each client sends the user's access token to NOVA System Hub.
3. NOVA validates the token and performs analysis.
4. Client-supplied OHLCV is untrusted input. It is never labelled broker-verified.
5. The clients do not contain service-role keys, broker credentials, or order execution capabilities.

## Analysis API

- Method: `POST`
- Path: `/v1/analysis/candles`
- Authentication: `Authorization: Bearer <Supabase user access token>`
- Contract: see the NOVA repository document `docs/architecture/VOOM-AI-ANALYSIS-API-V1.md`.

The web client reads `VITE_NOVA_ANALYSIS_API_BASE_URL`. Android will receive the API base URL and public Supabase project configuration through build-time configuration; no secrets belong in the APK.

## Safety invariants

- Live trading remains OFF.
- No order submission, broker write, deposit, or withdrawal endpoints are implemented.
- Paper Simulation must be explicitly labelled and must not imply a broker connection.
- Missing or invalid credentials must fail closed.
- Missing API configuration must produce a configuration error, not a fabricated response.

## Development and release

- Zero-cost strict.
- No CI/CD workflows.
- Local verification and manual review only.
- Build, signing, installation, deployment, merge, and production release are separate gates requiring explicit approval.
