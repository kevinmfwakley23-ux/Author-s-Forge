import { buildProjectContext } from "../application/context-pipeline";
import type { ProjectBrainQuery } from "../application/project-brain";
import type { ProjectMemoryStore } from "../application/project-memory-store";
import type { ForgeCore } from "../application/forge-core";
import type { AiTask } from "../application/ai-model-broker";
import { estimateTokens, optimizeContext } from "../application/context-optimizer";
import { SemanticCache, stableCacheKey } from "../application/semantic-cache";
import { generateWithKingsAi } from "./kings-ai-bridge";

export interface AiGenerationRequest { readonly system: string; readonly user: string; readonly temperature?: number; readonly maxOutputTokens?: number; }
export interface AiGenerationResult { readonly provider: "omniroute" | "9router" | "openai" | "ollama" | "kings"; readonly model: string; readonly text: string; readonly requestId?: string; readonly cacheHit?: boolean; readonly optimization?: { readonly originalEstimatedTokens: number; readonly optimizedEstimatedTokens: number; readonly tokensSaved: number; readonly compressionRatio: number; readonly strategy: readonly string[]; }; readonly attempts?: readonly AiProviderAttempt[]; }
export interface AiProviderAttempt { readonly provider: AiGenerationResult["provider"]; readonly model?: string; readonly success: boolean; readonly latencyMs: number; readonly error?: string; }

export interface ProjectAiGenerationRequest extends Omit<AiGenerationRequest, "system"> {
  readonly system?: string;
  readonly memory: ProjectMemoryStore;
  readonly context: ProjectBrainQuery;
  readonly contextBudget?: number;
}

const responseCache = new SemanticCache<AiGenerationResult>({
  maxEntries: readPositiveInteger(process.env.AI_CACHE_MAX_ENTRIES) ?? 128,
  ttlMs: readPositiveInteger(process.env.AI_CACHE_TTL_MS),
});

/**
 * Canonical Forge Brain generation boundary. ForgeCore selects the exact model,
 * owns retries/failover/cooldowns/telemetry, and this adapter only performs the
 * provider-specific HTTP execution for the selected resource.
 */
export async function generateTextThroughCore(core: ForgeCore, request: AiGenerationRequest, task: AiTask = "writing"): Promise<AiGenerationResult> {
  const optimized = optimizeContext({ system: request.system, user: request.user, maxInputTokens: readPositiveInteger(process.env.AI_CONTEXT_MAX_INPUT_TOKENS) });
  const optimizedRequest = { ...request, system: optimized.system, user: optimized.user };
  const optimization = { originalEstimatedTokens: optimized.originalEstimatedTokens, optimizedEstimatedTokens: optimized.optimizedEstimatedTokens, tokensSaved: optimized.tokensSaved, compressionRatio: optimized.compressionRatio, strategy: optimized.strategy };
  const resources = core.ai.listResources();
  if (resources.length === 0) throw new Error("No AI provider is configured. Configure OmniRoute/9Router, K.I.N.G.S., OpenAI, or Ollama. Forge never fabricates AI output.");

  const cacheEnabled = process.env.AI_CACHE_ENABLED?.trim().toLowerCase() === "true";
  const cacheable = cacheEnabled && (request.temperature ?? 0.7) === 0;
  const registrySignature = resources.map((resource) => `${resource.provider}/${resource.model}`).sort().join("|");
  const cacheKey = cacheable ? stableCacheKey(["forge-ai-core-v1", optimizedRequest.system, optimizedRequest.user, request.temperature ?? 0.7, request.maxOutputTokens ?? 4000, task, registrySignature]) : undefined;
  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached) return { ...cached, cacheHit: true, optimization };
  }

  const execution = await core.executeAi({
    task,
    input: optimizedRequest,
    maxAttempts: resources.length,
    estimatedInputTokens: optimized.optimizedEstimatedTokens,
    estimatedOutputTokens: request.maxOutputTokens ?? 4000,
    minimumOutputTokens: request.maxOutputTokens,
    requiresCreativeWriting: task === "writing" || task === "voice-preservation",
    requiresInstructionFollowing: task === "writing" || task === "editing" || task === "voice-preservation" || task === "continuity",
  }, async (input, context) => {
    const selectedProvider = asProviderName(context.resource.provider);
    return generateFromProvider(selectedProvider, input as AiGenerationRequest, context.resource.model);
  });

  const failureLatency = execution.failures.reduce((sum, failure) => sum + failure.latencyMs, 0);
  const attempts: AiProviderAttempt[] = [
    ...execution.failures.map((failure) => ({ provider: asProviderName(failure.provider), model: failure.model, success: false, latencyMs: failure.latencyMs, error: failure.error })),
    { provider: execution.value.provider, model: execution.value.model, success: true, latencyMs: Math.max(0, execution.latencyMs - failureLatency) },
  ];
  const finalResult: AiGenerationResult = { ...execution.value, cacheHit: false, optimization, attempts };
  if (cacheKey) responseCache.set(cacheKey, finalResult);
  return finalResult;
}

/** Legacy compatibility boundary. New production composition should use generateTextThroughCore. */
export async function generateText(request: AiGenerationRequest): Promise<AiGenerationResult> {
  const optimized = optimizeContext({ system: request.system, user: request.user, maxInputTokens: readPositiveInteger(process.env.AI_CONTEXT_MAX_INPUT_TOKENS) });
  const optimizedRequest = { ...request, system: optimized.system, user: optimized.user };
  const optimization = { originalEstimatedTokens: optimized.originalEstimatedTokens, optimizedEstimatedTokens: optimized.optimizedEstimatedTokens, tokensSaved: optimized.tokensSaved, compressionRatio: optimized.compressionRatio, strategy: optimized.strategy };
  const cacheEnabled = process.env.AI_CACHE_ENABLED?.trim().toLowerCase() === "true";
  const cacheable = cacheEnabled && (request.temperature ?? 0.7) === 0;
  const cacheKey = cacheable ? stableCacheKey(["forge-ai-v3", optimizedRequest.system, optimizedRequest.user, request.temperature ?? 0.7, request.maxOutputTokens ?? 4000, process.env.OMNIROUTE_MODEL?.trim() ?? "", process.env.ROUTER9_MODEL?.trim() ?? "", process.env.KINGS_AI_MODEL?.trim() ?? "", process.env.OPENAI_MODEL?.trim() ?? "", process.env.OLLAMA_MODEL?.trim() ?? ""]) : undefined;
  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached) return { ...cached, cacheHit: true, optimization };
  }

  const attempts: AiProviderAttempt[] = [];
  for (const provider of providerOrder()) {
    const started = Date.now();
    try {
      const result = await generateFromProvider(provider, optimizedRequest);
      attempts.push({ provider: result.provider, model: result.model, success: true, latencyMs: Date.now() - started });
      const finalResult = { ...result, cacheHit: false, optimization, attempts };
      if (cacheKey) responseCache.set(cacheKey, finalResult);
      return finalResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({ provider, model: configuredModelFor(provider), success: false, latencyMs: Date.now() - started, error: message });
    }
  }

  const configured = providerOrder().filter(hasProviderConfig);
  if (configured.length === 0) throw new Error("No AI provider is configured. Configure OmniRoute/9Router, K.I.N.G.S., OpenAI, or Ollama. Forge never fabricates AI output.");
  const detail = attempts.map((attempt) => `${attempt.provider}${attempt.model ? `/${attempt.model}` : ""}: ${attempt.error ?? "failed"}`).join(" | ");
  throw new Error(`All configured AI resources failed; Forge cannot safely generate without a real provider. ${detail}`);
}

export async function generateProjectText(request: ProjectAiGenerationRequest): Promise<AiGenerationResult> {
  const projectContext = buildProjectContext(request.memory, { query: request.context, budget: request.contextBudget ?? readPositiveInteger(process.env.AI_CONTEXT_MAX_INPUT_TOKENS) });
  const system = [request.system?.trim(), projectContext.system].filter(Boolean).join("\n\n");
  const result = await generateText({ system, user: request.user, temperature: request.temperature, maxOutputTokens: request.maxOutputTokens });
  if (!result.optimization) return result;
  const originalEstimatedTokens = projectContext.originalEstimatedTokens + estimateTokens([request.system?.trim(), request.user].filter(Boolean).join("\n\n"));
  const optimizedEstimatedTokens = result.optimization.optimizedEstimatedTokens;
  const tokensSaved = Math.max(0, originalEstimatedTokens - optimizedEstimatedTokens);
  return { ...result, optimization: { originalEstimatedTokens, optimizedEstimatedTokens, tokensSaved, compressionRatio: originalEstimatedTokens > 0 ? optimizedEstimatedTokens / originalEstimatedTokens : 1, strategy: [...projectContext.strategies, ...result.optimization.strategy] } };
}

type ProviderName = AiGenerationResult["provider"];

function providerOrder(): ProviderName[] {
  const configured = (process.env.AI_PROVIDER_ORDER?.trim() || "omniroute,9router,kings,openai,ollama").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean) as ProviderName[];
  const allowed = new Set<ProviderName>(["omniroute", "9router", "kings", "openai", "ollama"]);
  const unique = configured.filter((provider, index) => allowed.has(provider) && configured.indexOf(provider) === index);
  return unique.length ? unique : ["omniroute", "9router", "kings", "openai", "ollama"];
}

function hasProviderConfig(provider: ProviderName): boolean {
  switch (provider) {
    case "omniroute": return Boolean(process.env.OMNIROUTE_BASE_URL?.trim());
    case "9router": return Boolean(process.env.ROUTER9_BASE_URL?.trim());
    case "kings": return Boolean(process.env.KINGS_AI_ENDPOINT?.trim() && process.env.KINGS_AI_MODEL?.trim());
    case "openai": return Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim());
    case "ollama": return Boolean(process.env.OLLAMA_BASE_URL?.trim() && process.env.OLLAMA_MODEL?.trim());
  }
}

function configuredModelFor(provider: ProviderName): string | undefined {
  switch (provider) {
    case "omniroute": return process.env.OMNIROUTE_MODEL?.trim() || "auto";
    case "9router": return process.env.ROUTER9_MODEL?.trim() || "auto";
    case "kings": return process.env.KINGS_AI_MODEL?.trim();
    case "openai": return process.env.OPENAI_MODEL?.trim();
    case "ollama": return process.env.OLLAMA_MODEL?.trim();
  }
}

async function generateFromProvider(provider: ProviderName, request: AiGenerationRequest, selectedModel?: string): Promise<AiGenerationResult> {
  switch (provider) {
    case "omniroute": {
      const endpoint = process.env.OMNIROUTE_BASE_URL?.trim();
      if (!endpoint) throw new Error("OmniRoute is not configured.");
      return generateWithOpenAiCompatibleGateway("omniroute", endpoint, process.env.OMNIROUTE_API_KEY?.trim(), request, selectedModel?.trim() || process.env.OMNIROUTE_MODEL?.trim() || "auto");
    }
    case "9router": {
      const endpoint = process.env.ROUTER9_BASE_URL?.trim();
      if (!endpoint) throw new Error("9Router is not configured.");
      return generateWithOpenAiCompatibleGateway("9router", endpoint, process.env.ROUTER9_API_KEY?.trim(), request, selectedModel?.trim() || process.env.ROUTER9_MODEL?.trim() || "auto");
    }
    case "kings": {
      const endpoint = process.env.KINGS_AI_ENDPOINT?.trim();
      if (!endpoint) throw new Error("K.I.N.G.S. is not configured.");
      const model = selectedModel?.trim() || process.env.KINGS_AI_MODEL?.trim();
      if (!model || model === "auto") throw new Error("KINGS_AI_MODEL is required when K.I.N.G.S. is selected.");
      return generateWithKingsAi({ endpoint, model }, request);
    }
    case "openai": {
      const key = process.env.OPENAI_API_KEY?.trim();
      if (!key) throw new Error("OpenAI is not configured.");
      return generateOpenAi(key, request, selectedModel);
    }
    case "ollama": {
      const endpoint = process.env.OLLAMA_BASE_URL?.trim();
      if (!endpoint) throw new Error("Ollama is not configured.");
      return generateOllama(endpoint.replace(/\/$/, ""), request, selectedModel);
    }
  }
}

function asProviderName(provider: string): ProviderName {
  if (provider === "omniroute" || provider === "9router" || provider === "kings" || provider === "openai" || provider === "ollama") return provider;
  throw new Error(`Unsupported Forge AI provider selected by broker: ${provider}`);
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function generateWithOpenAiCompatibleGateway(provider: "omniroute" | "9router", baseUrl: string, apiKey: string | undefined, request: AiGenerationRequest, configuredModel: string): Promise<AiGenerationResult> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) }, body: JSON.stringify({ model: configuredModel, messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }], temperature: request.temperature ?? 0.7, ...(request.maxOutputTokens ? { max_tokens: request.maxOutputTokens } : {}) }) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "object" && payload.error ? String((payload.error as Record<string, unknown>).message ?? `${provider} request failed (${response.status}).`) : `${provider} request failed (${response.status}).`);
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const text = typeof message?.content === "string" ? message.content.trim() : "";
  if (!text) throw new Error(`${provider} returned no generated text.`);
  return { provider, model: configuredModel, text, requestId: typeof payload.id === "string" ? payload.id : undefined };
}

async function generateOpenAi(apiKey: string, request: AiGenerationRequest, selectedModel?: string): Promise<AiGenerationResult> {
  const model = selectedModel?.trim() || process.env.OPENAI_MODEL?.trim();
  if (!model || model === "auto") throw new Error("OPENAI_MODEL is required when OPENAI_API_KEY is configured.");
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model, input: [{ role: "system", content: request.system }, { role: "user", content: request.user }], temperature: request.temperature ?? 0.7, max_output_tokens: request.maxOutputTokens ?? 4000 }) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "object" && payload.error ? String((payload.error as Record<string, unknown>).message ?? `OpenAI request failed (${response.status}).`) : `OpenAI request failed (${response.status}).`);
  const text = extractOpenAiText(payload);
  if (!text) throw new Error("OpenAI returned no generated text.");
  return { provider: "openai", model, text, requestId: typeof payload.id === "string" ? payload.id : undefined };
}

async function generateOllama(baseUrl: string, request: AiGenerationRequest, selectedModel?: string): Promise<AiGenerationResult> {
  const model = selectedModel?.trim() || process.env.OLLAMA_MODEL?.trim();
  if (!model || model === "auto") throw new Error("OLLAMA_MODEL is required when OLLAMA_BASE_URL is configured.");
  const response = await fetch(`${baseUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, stream: false, messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }], options: { temperature: request.temperature ?? 0.7 } }) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Ollama request failed (${response.status}).`);
  const message = payload.message as Record<string, unknown> | undefined;
  const text = typeof message?.content === "string" ? message.content.trim() : "";
  if (!text) throw new Error("Ollama returned no generated text.");
  return { provider: "ollama", model, text };
}

function extractOpenAiText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") parts.push(String((part as Record<string, unknown>).text));
  }
  return parts.join("\n").trim();
}
