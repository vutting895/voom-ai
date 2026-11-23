# VOOM AI — POWERED BY NOVA

Client platform for Android and responsive web, integrated with NOVA Core through versioned APIs.

## Product scope

- Android client
- Responsive web client
- Thai / English interface
- Navy + Electric Blue visual direction
- Supabase Auth using user access tokens
- NOVA Analysis API v1 integration
- Read-only analysis and clearly labeled Paper Simulation

## Safety boundaries

- Live trading is OFF.
- No order submission, broker write operations, deposits, or withdrawals.
- Never expose Supabase service-role keys or other server secrets in client code.
- Client-supplied market data must not be represented as broker-verified data.
- Paper Simulation must remain visibly distinct from live account activity.

## Architecture

- NOVA Core remains the analysis and system backend.
- VOOM AI is the client application layer.
- Android and web clients communicate with NOVA through versioned API contracts.
- Authentication is handled through Supabase Auth; privileged credentials remain server-side.

## Development and CI policy

- Zero-cost strict: no paid services or billing activation without explicit approval.
- GitHub Actions CI is permitted for pull-request verification and explicitly requested manual runs.
- Android CI is scoped to Android/workflow changes, uses hosted Ubuntu runners, and has bounded job time and artifact retention.
- CI is verification-only: no deployment, signing, publishing, production release, or broker operations.
- GitHub Actions usage on this private repository may consume included minutes/storage and could incur charges if account allowances are exceeded. Monitor usage; do not increase runner size, retention, or workflow frequency without approval.
- Local verification remains preferred when practical; CI supplements it where the local environment lacks Android tooling.
- No Base44 runtime.
- Build, signing, installation, deployment, and production release require separate approval.

## Repository status

Application source code is developed on feature branches and reviewed through pull requests. Main is the source of truth; do not merge until required verification and manual review gates pass.

## Android CI

Workflow: `.github/workflows/android-build.yml`

- Pull requests targeting `main` that modify `apps/android/**` or the workflow itself.
- Manual `workflow_dispatch` runs.
- Builds a debug APK only; no signing or release APK.
- Uploads the debug APK as a short-lived artifact when the build succeeds.
