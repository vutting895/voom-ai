# VOOM Visual AI Dev/Test package

This package is an offline foundation for WO-2026-11-25-006. It does not connect to ComfyUI, provision a GPU, persist jobs, call external services, or provide a production HTTP server.

## Run tests

Requires Node.js with built-in `node:test` support (Node 20+):

```sh
node --test packages/visual-ai/test/*.test.mjs
```

## Current behavior

- Allowlisted workflow and model aliases.
- Tenant/user context required by the service layer.
- Tenant-scoped idempotency.
- Bounded prompt and generation parameters.
- Mock provider for deterministic queue/cancel/retry tests.
- Agent tools call the service seam only.

The current mock stores jobs in process memory and must not be treated as durable or multi-instance. Real ComfyUI HTTP/WebSocket adapter, authentication middleware, persistent queue, object storage, quota enforcement and production API routes are intentionally deferred.
