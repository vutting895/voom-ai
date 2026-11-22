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

## Development policy

- Zero-cost strict; no paid services or billing activation without explicit approval.
- No CI/CD. Use local verification and manual release gates.
- No Base44 runtime.
- Build, signing, installation, deployment, and production release require separate approval.

## Repository status

This is the initial repository bootstrap. Application source code and implementation documentation will be added on feature branches and reviewed through pull requests.
