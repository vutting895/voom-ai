# VOOM AI Workspace

Migration boundary for the AI Agent Workspace currently maintained in vutting895/voom-ai-f480ij.

Planned scope: conversational AI workspace and provider adapters; memory and document retrieval (RAG); user-scoped configuration and audit-safe security telemetry.

Import status: NOT STARTED.

Import gate:
- Do not copy env.env or any credential-bearing file.
- Do not import either legacy server implementation until route parity and security review select the canonical backend.
- Arbitrary custom endpoint fetching is prohibited until SSRF defenses are implemented.
- Memory/document access must be authenticated, tenant-scoped and backed by verified RLS policies.
- No broker execution or trading responsibility belongs in this application.
