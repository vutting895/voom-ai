# VOOM AI Client Foundation

## Architecture decision

This repository is a monorepo with two independently built clients:

- `apps/android`: native Android application using Kotlin and Jetpack Compose.
- `apps/web`: responsive web application using React, TypeScript, and Vite.

The clients share the versioned API contract, product terminology, safety rules, and design tokens documented in this repository. They do not share UI runtime code.

## Current implementation status

- Web: initial Supabase email/password sign-in and versioned analysis request UI are present. Windows validation passed dependency installation (79 packages), TypeScript typecheck, and Vite production build (72 modules transformed).
- Android: visual foundation only. Supabase Auth and NOVA Analysis API integration are **not implemented**. The primary action remains disabled.
- Android configuration defaults are intentionally empty; placeholder hostnames and fake keys must not be treated as valid configuration.
- Neither client is approved for production use.

## Trust boundaries

1. Supabase Auth issues user-scoped access tokens.
2. Each implemented client sends the user's access token to NOVA System Hub.
3. NOVA validates the token and performs analysis.
4. Client-supplied OHLCV is untrusted input. It is never labelled broker-verified.
5. The clients do not contain service-role keys, broker credentials, or order execution capabilities.

## Analysis API

- Method: `POST`
- Path: `/v1/analysis/candles`
- Authentication: `Authorization: Bearer <Supabase user access token>`
- Contract: see the NOVA repository document `docs/architecture/VOOM-AI-ANALYSIS-API-V1.md`.

The web client reads `VITE_NOVA_ANALYSIS_API_BASE_URL`. Android integration must use build-time public configuration and a user-scoped access token; no secrets belong in the APK.

## Safety invariants

- Live trading remains OFF.
- No order submission, broker write, deposit, or withdrawal endpoints are implemented.
- Paper Simulation must be explicitly labelled and must not imply a broker connection.
- Missing or invalid credentials must fail closed.
- Missing API configuration must produce a configuration error, not a fabricated response.

## Development, CI, and release

- Zero-cost strict; no paid service or billing activation is authorized.
- GitHub Actions is permitted for bounded, verification-only CI.
- Android CI builds a debug APK only; it does not sign, publish, deploy, or release.
- Automatic PR validation is limited to PR opened/reopened events; subsequent checks are manually dispatched to control private-repository Actions usage.
- GitHub Actions usage may consume included minutes/storage and could incur charges if account allowances are exceeded; monitor usage.
- Local verification and manual review remain required.
- Build, signing, installation, deployment, merge, and production release are separate gates requiring explicit approval.

## Android CI status

- Workflow: `.github/workflows/android-build.yml`.
- Run #1 and Run #3 both ended in failure before any step summary was recorded.
- The job-step endpoint returned an empty list and log download returned 404; no root cause can be established from available evidence.
- No successful Android build or APK artifact is confirmed.
