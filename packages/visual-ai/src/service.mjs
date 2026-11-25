const WORKFLOWS = Object.freeze({
  "product-image-v1": Object.freeze({ mode: "image", version: "1.0.0" }),
  "image-edit-v1": Object.freeze({ mode: "image-edit", version: "1.0.0" })
});
const MODELS = Object.freeze({
  "sdxl-base": Object.freeze({ providerModel: "mock-sdxl", version: "dev-test" })
});
const PARAM_KEYS = new Set(["width", "height", "steps", "seed", "outputs"]);
const REQUEST_KEYS = new Set(["requestId", "workflowId", "modelAlias", "prompt", "negativePrompt", "parameters", "inputAssetIds", "mode"]);
const MAX_RETRIES = 2;

export class VisualAiError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = "VisualAiError";
    this.code = code;
    this.retryable = retryable;
  }
}

function clone(value) {
  return structuredClone(value);
}

function validateRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new VisualAiError("INVALID_REQUEST", "Request must be an object.");
  }
  for (const key of Object.keys(request)) {
    if (!REQUEST_KEYS.has(key)) throw new VisualAiError("UNKNOWN_FIELD", `Unsupported request field: ${key}`);
  }
  if (typeof request.requestId !== "string" || request.requestId.length < 8 || request.requestId.length > 128) {
    throw new VisualAiError("INVALID_REQUEST_ID", "requestId must contain 8–128 characters.");
  }
  if (!WORKFLOWS[request.workflowId]) throw new VisualAiError("WORKFLOW_NOT_ALLOWED", "Workflow is not allowlisted.");
  if (!MODELS[request.modelAlias]) throw new VisualAiError("MODEL_NOT_ALLOWED", "Model alias is not allowlisted.");
  if (typeof request.prompt !== "string" || request.prompt.trim().length === 0 || request.prompt.length > 4000) {
    throw new VisualAiError("INVALID_PROMPT", "Prompt must contain 1–4000 characters.");
  }
  if (request.negativePrompt !== undefined && (typeof request.negativePrompt !== "string" || request.negativePrompt.length > 2000)) {
    throw new VisualAiError("INVALID_NEGATIVE_PROMPT", "negativePrompt exceeds the allowed limit.");
  }
  const parameters = request.parameters ?? {};
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    throw new VisualAiError("INVALID_PARAMETERS", "parameters must be an object.");
  }
  for (const key of Object.keys(parameters)) {
    if (!PARAM_KEYS.has(key)) throw new VisualAiError("UNKNOWN_PARAMETER", `Unsupported parameter: ${key}`);
  }
  const { width = 1024, height = 1024, steps = 24, seed = 0, outputs = 1 } = parameters;
  if (![width, height].every(v => Number.isInteger(v) && v >= 256 && v <= 2048 && v % 64 === 0)) {
    throw new VisualAiError("INVALID_DIMENSIONS", "width and height must be multiples of 64 between 256 and 2048.");
  }
  if (!Number.isInteger(steps) || steps < 1 || steps > 60) throw new VisualAiError("INVALID_STEPS", "steps must be between 1 and 60.");
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new VisualAiError("INVALID_SEED", "seed is outside the supported range.");
  if (!Number.isInteger(outputs) || outputs < 1 || outputs > 4) throw new VisualAiError("INVALID_OUTPUT_COUNT", "outputs must be between 1 and 4.");
  const mode = request.mode ?? WORKFLOWS[request.workflowId].mode;
  if (mode !== WORKFLOWS[request.workflowId].mode) throw new VisualAiError("WORKFLOW_MODE_MISMATCH", "Workflow does not support the requested mode.");
  const inputAssetIds = request.inputAssetIds ?? [];
  if (!Array.isArray(inputAssetIds) || inputAssetIds.length > 4 || inputAssetIds.some(id => typeof id !== "string" || !id || id.length > 128)) {
    throw new VisualAiError("INVALID_INPUT_ASSETS", "At most four valid input asset IDs are allowed.");
  }
  return {
    requestId: request.requestId,
    workflowId: request.workflowId,
    workflowVersion: WORKFLOWS[request.workflowId].version,
    modelAlias: request.modelAlias,
    prompt: request.prompt.trim(),
    negativePrompt: request.negativePrompt ?? "",
    parameters: { width, height, steps, seed, outputs },
    inputAssetIds: [...inputAssetIds],
    mode
  };
}

export class MockComfyProvider {
  #jobs = new Map();
  #nextId = 1;

  async createJob(input) {
    const jobId = `mock-job-${String(this.#nextId++).padStart(6, "0")}`;
    const now = new Date().toISOString();
    const job = {
      jobId,
      requestId: input.requestId,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      progress: 0,
      provider: "mock-comfy",
      workflowId: input.workflowId,
      workflowVersion: input.workflowVersion,
      modelAlias: input.modelAlias,
      outputAssetIds: [],
      retryCount: 0
    };
    this.#jobs.set(jobId, job);
    return clone(job);
  }

  async getJob(jobId) {
    const job = this.#jobs.get(jobId);
    return job ? clone(job) : null;
  }

  async cancelJob(jobId) {
    const job = this.#jobs.get(jobId);
    if (!job) return null;
    if (["succeeded", "failed", "cancelled"].includes(job.status)) return clone(job);
    job.status = "cancelled";
    job.progress = 0;
    job.updatedAt = new Date().toISOString();
    return clone(job);
  }

  async retryJob(jobId) {
    const job = this.#jobs.get(jobId);
    if (!job || job.status !== "failed" || job.retryCount >= MAX_RETRIES) return null;
    job.retryCount += 1;
    job.status = "queued";
    job.progress = 0;
    job.updatedAt = new Date().toISOString();
    return clone(job);
  }

  async setFailureForTest(jobId, retryable = true) {
    const job = this.#jobs.get(jobId);
    if (!job) return null;
    job.status = "failed";
    job.error = { code: "MOCK_PROVIDER_FAILURE", message: "Mock provider failure.", retryable };
    job.updatedAt = new Date().toISOString();
    return clone(job);
  }
}

export class VisualAiService {
  #provider;
  #jobs = new Map();
  #idempotency = new Map();

  constructor({ provider = new MockComfyProvider(), clock = () => new Date() } = {}) {
    this.#provider = provider;
    this.clock = clock;
  }

  #context(context) {
    if (!context || typeof context.tenantId !== "string" || !context.tenantId || typeof context.userId !== "string" || !context.userId) {
      throw new VisualAiError("UNAUTHENTICATED", "Verified user and tenant context are required.");
    }
    if (context.tenantId.length > 128 || context.userId.length > 128) throw new VisualAiError("INVALID_CONTEXT", "Identity context is invalid.");
  }

  async createJob(context, idempotencyKey, request) {
    this.#context(context);
    if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new VisualAiError("IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key is required.");
    }
    const normalized = validateRequest(request);
    const dedupeKey = `${context.tenantId}:${context.userId}:${idempotencyKey}`;
    const existingId = this.#idempotency.get(dedupeKey);
    if (existingId) return this.getJob(context, existingId);
    const providerJob = await this.#provider.createJob(normalized);
    const record = { ...providerJob, tenantId: context.tenantId, userId: context.userId, createdAt: this.clock().toISOString() };
    this.#jobs.set(record.jobId, record);
    this.#idempotency.set(dedupeKey, record.jobId);
    return this.#publicJob(record);
  }

  #publicJob(record) {
    const { tenantId, userId, retryCount, ...safe } = record;
    return clone(safe);
  }

  async getJob(context, jobId) {
    this.#context(context);
    const record = this.#jobs.get(jobId);
    if (!record || record.tenantId !== context.tenantId || record.userId !== context.userId) {
      throw new VisualAiError("JOB_NOT_FOUND", "Job was not found.");
    }
    const providerJob = await this.#provider.getJob(jobId);
    if (providerJob) Object.assign(record, providerJob);
    return this.#publicJob(record);
  }

  async cancelJob(context, jobId) {
    const current = await this.getJob(context, jobId);
    if (["succeeded", "failed", "cancelled"].includes(current.status)) return current;
    const updated = await this.#provider.cancelJob(jobId);
    if (!updated) throw new VisualAiError("JOB_NOT_FOUND", "Job was not found.");
    const record = this.#jobs.get(jobId);
    Object.assign(record, updated);
    return this.#publicJob(record);
  }

  async retryJob(context, jobId) {
    await this.getJob(context, jobId);
    const record = this.#jobs.get(jobId);
    if (!record.error?.retryable) throw new VisualAiError("RETRY_NOT_ALLOWED", "Only retryable provider failures can be retried.");
    if ((record.retryCount ?? 0) >= MAX_RETRIES) throw new VisualAiError("RETRY_LIMIT", "Retry limit reached.");
    const updated = await this.#provider.retryJob(jobId);
    if (!updated) throw new VisualAiError("RETRY_NOT_ALLOWED", "Job is not in a retryable state.");
    Object.assign(record, updated);
    return this.#publicJob(record);
  }

  async listWorkflows(context) {
    this.#context(context);
    return Object.entries(WORKFLOWS).map(([id, value]) => ({ id, ...value }));
  }

  async listModels(context) {
    this.#context(context);
    return Object.entries(MODELS).map(([alias, value]) => ({ alias, ...value }));
  }

  async failJobForTest(context, jobId, retryable = true) {
    await this.getJob(context, jobId);
    const updated = await this.#provider.setFailureForTest(jobId, retryable);
    Object.assign(this.#jobs.get(jobId), updated);
    return this.#publicJob(this.#jobs.get(jobId));
  }
}
