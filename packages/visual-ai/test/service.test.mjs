import test from "node:test";
import assert from "node:assert/strict";
import { MockComfyProvider, VisualAiError, VisualAiService } from "../src/service.mjs";
import { createVisualAiAgentTools } from "../src/agent-tools.mjs";

const tenantA = { tenantId: "tenant-a", userId: "user-a" };
const tenantB = { tenantId: "tenant-b", userId: "user-b" };
const request = (overrides = {}) => ({
  requestId: "request-0001",
  workflowId: "product-image-v1",
  modelAlias: "sdxl-base",
  prompt: "Minimal studio product photo",
  parameters: { width: 1024, height: 1024, steps: 24, outputs: 1 },
  mode: "image",
  ...overrides
});

test("creates an allowlisted job using the mock provider", async () => {
  const service = new VisualAiService();
  const job = await service.createJob(tenantA, "idem-key-0001", request());
  assert.equal(job.status, "queued");
  assert.equal(job.provider, "mock-comfy");
  assert.equal(job.workflowId, "product-image-v1");
  assert.equal("tenantId" in job, false);
  assert.equal("userId" in job, false);
});

test("requires verified tenant and user context", async () => {
  const service = new VisualAiService();
  await assert.rejects(() => service.createJob({ tenantId: "tenant-a" }, "idem-key-0001", request()), { code: "UNAUTHENTICATED" });
});

test("requires an idempotency key", async () => {
  const service = new VisualAiService();
  await assert.rejects(() => service.createJob(tenantA, "", request()), { code: "IDEMPOTENCY_KEY_REQUIRED" });
});

test("same tenant and idempotency key do not create duplicate jobs", async () => {
  const service = new VisualAiService();
  const first = await service.createJob(tenantA, "idem-key-0001", request());
  const second = await service.createJob(tenantA, "idem-key-0001", request({ requestId: "request-0002" }));
  assert.equal(first.jobId, second.jobId);
});

test("different tenants cannot read each other's jobs", async () => {
  const service = new VisualAiService();
  const job = await service.createJob(tenantA, "idem-key-0001", request());
  await assert.rejects(() => service.getJob(tenantB, job.jobId), { code: "JOB_NOT_FOUND" });
});

test("rejects arbitrary workflow IDs and runtime URLs", async () => {
  const service = new VisualAiService();
  await assert.rejects(() => service.createJob(tenantA, "idem-key-0001", request({ workflowId: "https://127.0.0.1/admin" })), { code: "WORKFLOW_NOT_ALLOWED" });
  await assert.rejects(() => service.createJob(tenantA, "idem-key-0002", request({ runtimeUrl: "http://127.0.0.1:8188" })), { code: "UNKNOWN_FIELD" });
});

test("rejects unknown parameters and unsafe dimensions", async () => {
  const service = new VisualAiService();
  await assert.rejects(() => service.createJob(tenantA, "idem-key-0001", request({ parameters: { width: 1024, height: 1024, arbitraryUrl: "http://localhost" } })), { code: "UNKNOWN_PARAMETER" });
  await assert.rejects(() => service.createJob(tenantA, "idem-key-0002", request({ parameters: { width: 300, height: 1024 } })), { code: "INVALID_DIMENSIONS" });
});

test("supports cancellation for an owned job", async () => {
  const service = new VisualAiService();
  const job = await service.createJob(tenantA, "idem-key-0001", request());
  const cancelled = await service.cancelJob(tenantA, job.jobId);
  assert.equal(cancelled.status, "cancelled");
});

test("retry is bounded and only allowed for retryable failures", async () => {
  const provider = new MockComfyProvider();
  const service = new VisualAiService({ provider });
  const job = await service.createJob(tenantA, "idem-key-0001", request());
  await service.failJobForTest(tenantA, job.jobId, true);
  assert.equal((await service.retryJob(tenantA, job.jobId)).status, "queued");
  await service.failJobForTest(tenantA, job.jobId, true);
  assert.equal((await service.retryJob(tenantA, job.jobId)).status, "queued");
  await service.failJobForTest(tenantA, job.jobId, true);
  await assert.rejects(() => service.retryJob(tenantA, job.jobId), { code: "RETRY_LIMIT" });
});

test("Agent tools expose only allowlisted service operations", async () => {
  const service = new VisualAiService();
  const tools = createVisualAiAgentTools(service, tenantA);
  assert.deepEqual(Object.keys(tools).sort(), [
    "visual_ai_cancel_job",
    "visual_ai_create_job",
    "visual_ai_get_job",
    "visual_ai_list_models",
    "visual_ai_list_workflows"
  ]);
  const job = await tools.visual_ai_create_job({ idempotencyKey: "idem-key-0001", request: request() });
  assert.equal((await tools.visual_ai_get_job({ jobId: job.jobId })).jobId, job.jobId);
  assert.equal((await tools.visual_ai_list_workflows()).length, 2);
});

test("returns generic not-found response across tenant boundaries", async () => {
  const service = new VisualAiService();
  const job = await service.createJob(tenantA, "idem-key-0001", request());
  await assert.rejects(() => service.cancelJob(tenantB, job.jobId), error => error instanceof VisualAiError && error.code === "JOB_NOT_FOUND");
});
