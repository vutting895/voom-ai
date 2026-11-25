# VOOM Visual AI API and MCP Contract — P1

**Status:** Draft / Dev-Test only  
**Canonical schemas:** `voom-shared-contracts/contracts/api/v1/visual-ai-create-job.schema.json`, `visual-ai-job-response.schema.json`, and `contracts/mcp/v1/visual-ai-tools.json`.

## HTTP API outline

All routes are server-side and require a verified user session. The server derives `tenantId` and `userId`; callers cannot override either field.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/visual/v1/jobs` | Create a job; requires `Idempotency-Key` |
| GET | `/api/visual/v1/jobs/{jobId}` | Read an owner-scoped job |
| POST | `/api/visual/v1/jobs/{jobId}/cancel` | Request cancellation |
| POST | `/api/visual/v1/jobs/{jobId}/retry` | Retry a retryable failure within the retry budget |
| GET | `/api/visual/v1/workflows` | List approved workflow templates |
| GET | `/api/visual/v1/models` | List approved model aliases |
| GET | `/api/visual/v1/assets` | List owner-scoped output metadata |

## Request rules

- Only allowlisted `workflowId` and `modelAlias` values are accepted.
- Request body is bounded; prompt ≤ 4,000 chars, negative prompt ≤ 2,000 chars, up to four input asset IDs, dimensions 256–2048 in multiples of 64, steps 1–60, outputs 1–4.
- No arbitrary ComfyUI URL, workflow graph, node class, filesystem path, shell command, custom-node installation, or model download is accepted.
- `requestId` is a correlation identifier; `Idempotency-Key` is tenant-scoped and retained for the defined idempotency window.
- Error responses use stable error codes and do not disclose provider internals or credentials.

## Job state machine

`queued → validating → running → succeeded | failed | cancel_requested → cancelled`

Terminal states are immutable except a retry creates a new attempt under the same logical request. Cancellation is asynchronous for real GPU work; the API must not claim completion until the provider confirms it.

## MCP Agent tools

The Agent receives only:
- `visual_ai_create_job`
- `visual_ai_get_job`
- `visual_ai_cancel_job`
- `visual_ai_list_workflows`
- `visual_ai_list_models`

Every call is bound to authenticated tenant context and audited. The MCP adapter invokes the Visual AI service, never the ComfyUI runtime directly. The tool surface intentionally excludes arbitrary URL, arbitrary workflow JSON, shell, filesystem, custom-node install, and all broker/trading tools.

## Reliability and cost

- Idempotent create; bounded retries (maximum two retries after initial attempt).
- Retry only transient provider errors; no retry for validation, policy, quota or authorization failures.
- Provider timeout and concurrency are server-side configuration, not user input.
- Local/self-hosted ComfyUI is the default provider. Managed GPU providers are disabled unless separately approved.
- Production queue, object storage, signed URL, event transport and tenant database mapping are deferred beyond P2.

## Compatibility and decision gates

This contract is draft and not production-approved. Before production: validate against the actual auth/tenant contract, publish a versioned package, run consumer contract tests, threat-model actual provider network, verify data retention, capacity and cost limits, and obtain separate deployment/provider-cost approval.
