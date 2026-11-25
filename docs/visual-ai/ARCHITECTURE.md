# VOOM Visual AI — P0 Architecture

**Status:** Dev/Test design, not production-approved  
**Work Order:** WO-2026-11-25-006  
**Runtime strategy:** Hybrid Zero-cost First

## Goal

A user submits one natural-language creative request in VOOM. An Agent interprets it, selects an approved workflow and model alias, and submits a tenant-scoped job. The user sees progress and receives media assets without opening ComfyUI or editing a node graph.

## Component ownership

| Component | Owner | Responsibility |
|---|---|---|
| VOOM AI Workspace | voom-ai | User experience, project context, job presentation, asset library UI |
| Agent/MCP adapter | VOOM AI integration seam | Translate approved intents into typed service calls; no direct runtime access |
| Visual AI Service | VOOM AI Dev/Test package initially | Auth-context boundary, allowlist, validation, idempotency, job lifecycle |
| ComfyUI Provider Adapter | VOOM AI backend package | Server-to-server adapter interface to ComfyUI HTTP/WebSocket API |
| ComfyUI Runtime | Separate GPU worker | Execute approved workflow templates and model versions |
| NOVA Core | VOOM_SYSTEM-NOVA-AI | Existing ecosystem control plane/gateway; integration only through approved APIs in a later phase |
| Shared Contracts | voom-shared-contracts | Versioned HTTP/MCP schemas, fixtures, compatibility and validation rules |
| Datacenter | Datacenter | Dataset/model evaluation only where explicitly requested; not a ComfyUI job executor |

## Trust boundaries

1. Browser → VOOM server/API: authenticated user session; server derives tenant/user identity. Client-supplied tenant IDs are ignored.
2. Agent → Visual AI service: allowlisted tools and typed arguments; server rechecks user/tenant scope and quota.
3. Visual AI service → ComfyUI: private server-to-server connection only. Never expose runtime URL or credentials to browser/Agent.
4. Runtime → media storage: bounded output references; storage access remains owner-scoped.
5. External model/custom-node ecosystem: untrusted supply chain. No arbitrary custom node installation or runtime code execution.

## Request lifecycle

1. User submits prompt, mode, approved workflow ID, model alias and bounded parameters.
2. Agent normalizes intent and proposes a workflow; service validates allowlists and user context.
3. Service checks idempotency, limits, ownership and resource policy before queueing.
4. Provider returns a job ID; state moves through queued → validating → running → succeeded/failed/cancelled.
5. Progress events are correlated to job ID and tenant. Retries are bounded and only occur for retryable failures.
6. Output metadata is stored under the owning tenant; clients receive asset IDs or short-lived signed URLs in a later storage integration.
7. Quality checks validate MIME type, file size, dimensions, duration and expected output count before marking the job succeeded.

## Hybrid Zero-cost First

- Default: local GPU or self-hosted GPU worker operated by the user/organization.
- Dev/Test: deterministic MockComfyProvider, requiring no GPU, subscription, cloud allocation or network.
- Optional future provider: managed GPU/Comfy Cloud only after separate cost approval; disabled by default.
- Provider selection is server-side. Users cannot submit provider URLs or override routing.
- Cloudflare Workers are control-plane/API components only; large image/video inference runs on a dedicated GPU worker, not inside the Worker runtime.

## Failure and capacity controls

- Queue is durable in a future production phase; current P2 mock is in-memory and is not durable.
- Enforce per-tenant concurrency, request/prompt size, image dimensions, output count, runtime timeout, output size and retry budget.
- Use exponential backoff with jitter for transient provider failures; never retry validation, authorization or policy failures.
- Support cancellation as a request; do not claim a running GPU process has stopped until provider confirms it.
- Dead-letter exhausted jobs; retain metadata-only audit events.
- Fail closed when auth, tenant context, allowlist, provider health or quota cannot be established.

## Security threat model

| Threat | Required mitigation |
|---|---|
| Cross-tenant job/asset access | Derive tenant from verified auth; enforce owner checks on every read/write |
| SSRF / internal URL access | No user-provided runtime URL; fixed server-side provider configuration and network egress allowlist |
| Arbitrary workflow execution | Server-side workflow ID allowlist; never accept raw ComfyUI graph from clients |
| Malicious custom nodes/models | Pin and review node/model versions; isolated worker; no runtime installation from user prompts |
| Prompt/file abuse | MIME sniffing, size caps, malware scanning policy and retention controls before production |
| Resource exhaustion | Queue quotas, concurrency caps, max steps/resolution/duration/output count and timeouts |
| Replay/duplicate jobs | Tenant-scoped idempotency keys and request correlation |
| Secret leakage | Keep credentials server-side; redact logs; no tokens in prompts, outputs, fixtures or browser bundle |
| Forged progress callbacks | Authenticated provider channel, signed events and monotonic state transitions |
| Cost runaway | Local-first provider; managed providers disabled; preflight estimate and hard spend ceiling |

## Explicit exclusions

P0–P2 do not provision GPUs, connect a live ComfyUI server, add production API routes, modify NOVA/Cloudflare/Netlify/Supabase, create storage buckets, deploy, enable paid services, or expose trading/order capabilities.
