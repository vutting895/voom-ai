# VOOM AI Repository Work Order Instructions

- Repository: `vutting895/voom-ai`
- Default branch: `main`
- Applicable Work Order: [WO-2026-11-25-006](https://github.com/vutting895/voom-shared-contracts/blob/work/wo-2026-11-25-006-visual-ai-comfyui/work-orders/WO-2026-11-25-006-voom-visual-ai-comfyui.md)
- Approved development branch: `feature/wo-2026-11-25-006-visual-ai-comfyui`
- Main baseline at branch creation: `219cee7bd3258f122fc706d49503dcd79b91ca20`

## Mandatory rules
1. Recheck this repository's `refs/heads/main` SHA before each new work session.
2. Read the central Work Order and this file before changing files.
3. Keep all work on the approved feature branch. Never write to Main, rebase existing PR branches, or modify existing PRs #1–#8.
4. P0–P2 only: architecture, draft contracts/Agent interface, and offline mock adapter/tests.
5. Do not deploy, provision GPU, connect a real ComfyUI endpoint, modify production databases/storage, change secrets/permissions, activate paid services, or call broker/trading capabilities.
6. No CI/CD additions. Use Node's built-in test runner; no external dependencies.
7. Record exact before/after commit SHAs, paths, commands, test results, and blockers in `logs/WO-2026-11-25-006-execution.md`.
8. Report DONE only after reading back branch files and verifying tests. Missing test execution is NOT VERIFIED.

## Architecture boundary
VOOM AI owns the user-facing workflow and provider-neutral application seam. ComfyUI is a separate server-side worker. The browser and Agent never receive raw ComfyUI URLs, credentials, arbitrary workflow JSON, filesystem access, or shell execution. NOVA remains the ecosystem control plane; no NOVA source changes are included in this Work Order.
