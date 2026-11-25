// Agent/MCP tools call the authenticated VisualAiService only.
// No ComfyUI URL, credential, raw workflow graph, shell or filesystem tool is exposed.
export function createVisualAiAgentTools(service, context) {
  if (!service || typeof service.createJob !== "function") throw new TypeError("VisualAiService is required.");
  return Object.freeze({
    visual_ai_create_job: async ({ idempotencyKey, request }) => service.createJob(context, idempotencyKey, request),
    visual_ai_get_job: async ({ jobId }) => service.getJob(context, jobId),
    visual_ai_cancel_job: async ({ jobId }) => service.cancelJob(context, jobId),
    visual_ai_list_workflows: async () => service.listWorkflows(context),
    visual_ai_list_models: async () => service.listModels(context)
  });
}
