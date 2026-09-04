import { buildProjectContext } from "../application/context-pipeline";
import type { ProjectBrainQuery } from "../application/project-brain";
import type { ProjectMemoryStore } from "../application/project-memory-store";
import { estimateTokens, optimizeContext } from "../application/context-optimizer";
import { SemanticCache, stableCacheKey } from "../application/semantic-cache";
import { AiExecutionFallback } from "../application/ai-execution-fallback";
import { AiModelBroker, type AiSpendPolicy, type AiTask } from "../application/ai-model-broker";
import { AiRoutingState } from "../application/ai-routing-state";
import type { AiCostRoutingMode } from "../application/ai-cost-routing-policy";
import { assertForgeOutputQuality, buildForgeQualityContract, type ForgeOutputQualityReport } from "../application/forge-quality-contract";
import { discoverConfiguredAiModelResources } from "./ai-model-resources";
import { generateWithKingsAi } from "./kings-ai-bridge";
import { resolveOpenAiCompatibleGatewayModel } from "./openai-compatible-gateways";

export interface AiTokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly source: "provider";
}

export interface AiGenerationRequest {
  readonly system: string;
  readonly user: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly task?: AiTask;
  readonly routingMode?: AiCostRoutingMode;
  readonly spendPolicy?: AiSpendPolicy;
  readonly maxEstimatedRequestCostUsd?: number;
  readonly trustedNoSpendModels?: readonly string[];
  readonly preferProvider?: string;
  readonly preferModel?: string;
  readonly quotaSafetyFraction?: number;
  readonly requiresReasoning?: boolean;
  readonly requiresVision?: boolean;
  readonly requiresToolCalls?: boolean;
  readonly requiresStreaming?: boolean;
  readonly requiresCreativeWriting?: boolean;
  readonly requiresInstructionFollowing?: boolean;
}
export interface AiGenerationResult {
  readonly provider: "omniroute" | "9router" | "openai" | "ollama" | "kings" | "groq" | "mistral" | "gemini" | "anthropic" | "openrouter" | "gateway";
  readonly model: string;
  readonly text: string;
  readonly requestId?: string;
  readonly cacheHit?: boolean;
  readonly usage?: AiTokenUsage;
  readonly quality?: ForgeOutputQualityReport;
  readonly routing?: {
    readonly accountedTokens: number;
    readonly usageSource: "provider" | "estimated" | "cache";
    readonly task: AiTask;
    readonly mode: AiCostRoutingMode;
    readonly spendPolicy: AiSpendPolicy;
  };
  readonly optimization?: {
    readonly originalEstimatedTokens: number;
    readonly optimizedEstimatedTokens: number;
    readonly tokensSaved: number;
    readonly compressionRatio: number;
    readonly strategy: readonly string[];
  };
  readonly attempts?: readonly AiProviderAttempt[];
}
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

let liveBroker = new AiModelBroker();
let liveRoutingState = new AiRoutingState();
let liveFallback = new AiExecutionFallback(liveBroker, liveRoutingState);

/** Bind live provider execution to the actual ForgeCore broker/routing objects. */
export function bindForgeAiRuntime(broker: AiModelBroker, routingState: AiRoutingState): void {
  liveBroker = broker;
  liveRoutingState = routingState;
  liveFallback = new AiExecutionFallback(liveBroker, liveRoutingState);
  refreshLiveBroker();
}

/**
 * Authoritative live AI boundary for every Forge office.
 * Uses one shared quality contract, model broker, quota reserve, spend policy,
 * cooldown/failure telemetry, capability routing and real provider failover.
 */
export async function generateText(request: AiGenerationRequest): Promise<AiGenerationResult> {
  const task = request.task ?? "writing";
  const governedSystem = [buildForgeQualityContract(task), request.system].filter(Boolean).join("\n\n");
  const optimized = optimizeContext({ system: governedSystem, user: request.user, maxInputTokens: readPositiveInteger(process.env.AI_CONTEXT_MAX_INPUT_TOKENS) });
  const optimizedRequest = { ...request, system: optimized.system, user: optimized.user };
  const optimization = {
    originalEstimatedTokens: optimized.originalEstimatedTokens,
    optimizedEstimatedTokens: optimized.optimizedEstimatedTokens,
    tokensSaved: optimized.tokensSaved,
    compressionRatio: optimized.compressionRatio,
    strategy: optimized.strategy,
  };
  const resources = refreshLiveBroker();
  if (!resources.length) throw new Error("No AI provider is configured. Configure OmniRoute, 9Router, K.I.N.G.S., Ollama, Groq, Mistral, Gemini, Anthropic, OpenRouter, OpenAI, or an OpenAI-compatible gateway. Forge never fabricates AI output.");

  const routingMode = request.routingMode ?? routingModeFromEnv(process.env.AI_ROUTING_MODE);
  const spendPolicy = request.spendPolicy ?? spendPolicyFromEnv(process.env.AI_SPEND_POLICY);
  const maxOutputTokens = request.maxOutputTokens ?? 4000;
  const providerPreference = providerOrder();
  const trustedNoSpendModels = request.trustedNoSpendModels ?? csv(process.env.AI_TRUSTED_NO_SPEND_MODELS);
  const maxEstimatedRequestCostUsd = request.maxEstimatedRequestCostUsd ?? readNonnegative(process.env.AI_MAX_REQUEST_COST_USD);
  const cacheEnabled = process.env.AI_CACHE_ENABLED?.trim().toLowerCase() === "true";
  const cacheable = cacheEnabled && (request.temperature ?? 0.7) === 0;
  const resourceSignature = resources.map((resource) => `${resource.provider}/${resource.model}/${resource.billingClass ?? "unknown"}`).join("|");
  const cacheKey = cacheable ? stableCacheKey(["forge-ai-v6", optimizedRequest.system, optimizedRequest.user, request.temperature ?? 0.7, maxOutputTokens, task, routingMode, spendPolicy, request.preferProvider ?? "", request.preferModel ?? "", resourceSignature]) : undefined;
  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached) {
      const { usage: _usage, ...withoutUsage } = cached;
      return { ...withoutUsage, cacheHit: true, optimization, routing: { accountedTokens: 0, usageSource: "cache", task, mode: routingMode, spendPolicy } };
    }
  }

  try {
    const execution = await liveFallback.execute<AiGenerationResult>({
      task,
      input: optimizedRequest,
      maxAttempts: resources.length,
      routingMode,
      spendPolicy,
      maxEstimatedRequestCostUsd,
      trustedNoSpendModels,
      preferProvider: request.preferProvider,
      preferModel: request.preferModel,
      preferredProviders: providerPreference,
      estimatedInputTokens: optimized.optimizedEstimatedTokens,
      estimatedOutputTokens: maxOutputTokens,
      minimumContextWindow: optimized.optimizedEstimatedTokens + maxOutputTokens,
      minimumOutputTokens: maxOutputTokens,
      quotaSafetyFraction: request.quotaSafetyFraction ?? readFraction(process.env.AI_QUOTA_SAFETY_FRACTION) ?? 0.1,
      requiresReasoning: request.requiresReasoning,
      requiresVision: request.requiresVision,
      requiresToolCalls: request.requiresToolCalls,
      requiresStreaming: request.requiresStreaming,
      requiresCreativeWriting: request.requiresCreativeWriting ?? (task === "writing" || task === "voice-preservation"),
      requiresInstructionFollowing: request.requiresInstructionFollowing ?? true,
    }, async (_input, context) => {
      const generated = await generateFromProvider(context.resource.provider as ProviderName, context.resource.model, optimizedRequest);
      const quality = assertForgeOutputQuality({ text: generated.text, task, userPrompt: optimizedRequest.user });
      return { ...generated, quality };
    }, (value) => value.usage?.totalTokens);

    const attempts: AiProviderAttempt[] = [
      ...execution.failures.map((failure) => ({ provider: failure.provider as ProviderName, model: failure.model, success: false, latencyMs: failure.latencyMs, error: failure.error })),
      { provider: execution.value.provider, model: execution.value.model, success: true, latencyMs: execution.latencyMs },
    ];
    const finalResult: AiGenerationResult = {
      ...execution.value,
      cacheHit: false,
      optimization,
      attempts,
      routing: { accountedTokens: execution.accountedTokens, usageSource: execution.usageSource, task, mode: routingMode, spendPolicy },
    };
    if (cacheKey) responseCache.set(cacheKey, finalResult);
    return finalResult;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Forge AI broker could not complete the ${task} request under spend policy "${spendPolicy}" without violating real provider/capability/quota/quality safety. ${detail}`);
  }
}

export async function generateProjectText(request: ProjectAiGenerationRequest): Promise<AiGenerationResult> {
  const projectContext = buildProjectContext(request.memory, { query: request.context, budget: request.contextBudget ?? readPositiveInteger(process.env.AI_CONTEXT_MAX_INPUT_TOKENS) });
  const system = [request.system?.trim(), projectContext.system].filter(Boolean).join("\n\n");
  const result = await generateText({
    system,
    user: request.user,
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
    task: request.task,
    routingMode: request.routingMode,
    spendPolicy: request.spendPolicy,
    maxEstimatedRequestCostUsd: request.maxEstimatedRequestCostUsd,
    trustedNoSpendModels: request.trustedNoSpendModels,
    preferProvider: request.preferProvider,
    preferModel: request.preferModel,
    quotaSafetyFraction: request.quotaSafetyFraction,
    requiresReasoning: request.requiresReasoning,
    requiresVision: request.requiresVision,
    requiresToolCalls: request.requiresToolCalls,
    requiresStreaming: request.requiresStreaming,
    requiresCreativeWriting: request.requiresCreativeWriting,
    requiresInstructionFollowing: request.requiresInstructionFollowing,
  });
  if (!result.optimization) return result;
  const originalEstimatedTokens = projectContext.originalEstimatedTokens + estimateTokens([request.system?.trim(), request.user].filter(Boolean).join("\n\n"));
  const optimizedEstimatedTokens = result.optimization.optimizedEstimatedTokens;
  const tokensSaved = Math.max(0, originalEstimatedTokens - optimizedEstimatedTokens);
  return {
    ...result,
    optimization: {
      originalEstimatedTokens,
      optimizedEstimatedTokens,
      tokensSaved,
      compressionRatio: originalEstimatedTokens > 0 ? optimizedEstimatedTokens / originalEstimatedTokens : 1,
      strategy: [...projectContext.strategies, ...result.optimization.strategy],
    },
  };
}

/** Observable live routing state for health/status surfaces and verification. */
export function aiRoutingTelemetry() {
  refreshLiveBroker();
  return liveRoutingState.snapshot();
}

/** Current configured resources including billing classification for UI/control surfaces. */
export function aiConfiguredResources() {
  return refreshLiveBroker();
}

type ProviderName = AiGenerationResult["provider"];

function refreshLiveBroker() {
  const resources = discoverConfiguredAiModelResources(process.env);
  liveBroker.setResources(resources);
  liveRoutingState.hydrate(resources);
  liveBroker.applyRoutingTelemetry(liveRoutingState.snapshot().map((state) => ({
    provider: state.provider,
    model: state.model,
    consecutiveFailures: state.consecutiveFailures,
    totalTokens: state.totalTokens,
    lastLatencyMs: state.lastLatencyMs,
    cooldownUntil: state.cooldownUntil,
  })));
  return liveBroker.listResources();
}

function providerOrder(): ProviderName[] {
  const defaults: ProviderName[] = ["omniroute", "9router", "kings", "ollama", "groq", "mistral", "gemini", "anthropic", "openrouter", "gateway", "openai"];
  const configured = (process.env.AI_PROVIDER_ORDER?.trim() || defaults.join(",")).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean) as ProviderName[];
  const allowed = new Set<ProviderName>(defaults);
  const unique = configured.filter((provider, index) => allowed.has(provider) && configured.indexOf(provider) === index);
  return unique.length ? unique : defaults;
}

async function generateFromProvider(provider: ProviderName, model: string, request: AiGenerationRequest): Promise<AiGenerationResult> {
  switch (provider) {
    case "omniroute": {
      const endpoint = process.env.OMNIROUTE_BASE_URL?.trim();
      if (!endpoint) throw new Error("OmniRoute is not configured.");
      return generateWithOpenAiCompatibleGateway("omniroute", endpoint, process.env.OMNIROUTE_API_KEY?.trim(), request, model);
    }
    case "9router": {
      const endpoint = process.env.ROUTER9_BASE_URL?.trim();
      if (!endpoint) throw new Error("9Router is not configured.");
      return generateWithOpenAiCompatibleGateway("9router", endpoint, process.env.ROUTER9_API_KEY?.trim(), request, model);
    }
    case "openrouter": {
      const key = process.env.OPENROUTER_API_KEY?.trim();
      if (!key) throw new Error("OpenRouter is not configured.");
      return generateWithOpenAiCompatibleGateway("openrouter", process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api", key, request, model, { "HTTP-Referer": process.env.OPENROUTER_SITE_URL?.trim() || "https://authors-forge.local", "X-OpenRouter-Title": "Author's Forge" });
    }
    case "groq": {
      const key = process.env.GROQ_API_KEY?.trim();
      if (!key) throw new Error("Groq is not configured.");
      return generateWithOpenAiCompatibleGateway("groq", process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai", key, request, model);
    }
    case "mistral": {
      const key = process.env.MISTRAL_API_KEY?.trim();
      if (!key) throw new Error("Mistral is not configured.");
      return generateWithOpenAiCompatibleGateway("mistral", process.env.MISTRAL_BASE_URL?.trim() || "https://api.mistral.ai", key, request, model);
    }
    case "gateway": {
      const resolved = resolveOpenAiCompatibleGatewayModel(model);
      const generated = await generateWithOpenAiCompatibleGateway("gateway", resolved.gateway.baseUrl, resolved.apiKey, request, resolved.upstreamModel);
      return { ...generated, model };
    }
    case "gemini": {
      const key = process.env.GEMINI_API_KEY?.trim();
      if (!key) throw new Error("Gemini is not configured.");
      return generateGemini(key, model, request);
    }
    case "anthropic": {
      const key = process.env.ANTHROPIC_API_KEY?.trim();
      if (!key) throw new Error("Anthropic is not configured.");
      return generateAnthropic(key, model, request);
    }
    case "kings": {
      const endpoint = process.env.KINGS_AI_ENDPOINT?.trim();
      if (!endpoint) throw new Error("K.I.N.G.S. is not configured.");
      return generateWithKingsAi({ endpoint, apiKey: process.env.KINGS_AI_API_KEY?.trim(), model }, request) as Promise<AiGenerationResult>;
    }
    case "openai": {
      const key = process.env.OPENAI_API_KEY?.trim();
      if (!key) throw new Error("OpenAI is not configured.");
      return generateOpenAi(key, model, request);
    }
    case "ollama": {
      const endpoint = process.env.OLLAMA_BASE_URL?.trim();
      if (!endpoint) throw new Error("Ollama is not configured.");
      return generateOllama(endpoint.replace(/\/$/, ""), model, request);
    }
  }
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
function readNonnegative(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
function readFraction(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed < 1 ? parsed : undefined;
}
function routingModeFromEnv(value: string | undefined): AiCostRoutingMode {
  const normalized = value?.trim().toLowerCase();
  return normalized === "balanced" || normalized === "quality" ? normalized : "economy";
}
function spendPolicyFromEnv(value: string | undefined): AiSpendPolicy {
  const normalized = value?.trim().toLowerCase();
  return normalized === "budgeted" || normalized === "unrestricted" ? normalized : "no-paid-tokens";
}
function csv(value: string | undefined): string[] { return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? []; }

async function generateWithOpenAiCompatibleGateway(provider: "omniroute" | "9router" | "groq" | "mistral" | "openrouter" | "gateway", baseUrl: string, apiKey: string | undefined, request: AiGenerationRequest, model: string, extraHeaders: Record<string, string> = {}): Promise<AiGenerationResult> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}), ...extraHeaders }, body: JSON.stringify({ model, messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }], temperature: request.temperature ?? 0.7, ...(request.maxOutputTokens ? { max_tokens: request.maxOutputTokens } : {}) }) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "object" && payload.error ? String((payload.error as Record<string, unknown>).message ?? `${provider} request failed (${response.status}).`) : `${provider} request failed (${response.status}).`);
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const text = typeof message?.content === "string" ? message.content.trim() : textFromContent(message?.content);
  if (!text) throw new Error(`${provider} returned no generated text.`);
  const usage = chatUsage(payload);
  return { provider, model, text, requestId: typeof payload.id === "string" ? payload.id : undefined, ...(usage ? { usage } : {}) };
}

async function generateOpenAi(apiKey: string, model: string, request: AiGenerationRequest): Promise<AiGenerationResult> {
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model, input: [{ role: "system", content: request.system }, { role: "user", content: request.user }], temperature: request.temperature ?? 0.7, max_output_tokens: request.maxOutputTokens ?? 4000 }) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "object" && payload.error ? String((payload.error as Record<string, unknown>).message ?? `OpenAI request failed (${response.status}).`) : `OpenAI request failed (${response.status}).`);
  const text = extractOpenAiText(payload);
  if (!text) throw new Error("OpenAI returned no generated text.");
  const usage = responsesUsage(payload);
  return { provider: "openai", model, text, requestId: typeof payload.id === "string" ? payload.id : undefined, ...(usage ? { usage } : {}) };
}

async function generateAnthropic(apiKey: string, model: string, request: AiGenerationRequest): Promise<AiGenerationResult> {
  const response = await fetch(`${process.env.ANTHROPIC_BASE_URL?.trim()?.replace(/\/$/, "") || "https://api.anthropic.com"}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": process.env.ANTHROPIC_VERSION?.trim() || "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: request.maxOutputTokens ?? 4000, system: request.system, messages: [{ role: "user", content: request.user }], ...(request.temperature === undefined ? {} : { temperature: request.temperature }) }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(anthropicError(payload) || `Anthropic request failed (${response.status}).`);
  const text = textFromContent(payload.content);
  if (!text) throw new Error("Anthropic returned no generated text.");
  const usage = anthropicUsage(payload);
  return { provider: "anthropic", model, text, requestId: typeof payload.id === "string" ? payload.id : undefined, ...(usage ? { usage } : {}) };
}

async function generateGemini(apiKey: string, model: string, request: AiGenerationRequest): Promise<AiGenerationResult> {
  const base = process.env.GEMINI_BASE_URL?.trim()?.replace(/\/$/, "") || "https://generativelanguage.googleapis.com/v1beta";
  const response = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: [{ text: request.user }] }],
      generationConfig: { ...(request.temperature === undefined ? {} : { temperature: request.temperature }), ...(request.maxOutputTokens ? { maxOutputTokens: request.maxOutputTokens } : {}) },
    }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(geminiError(payload) || `Gemini request failed (${response.status}).`);
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const first = candidates[0] as Record<string, unknown> | undefined;
  const content = first?.content as Record<string, unknown> | undefined;
  const text = textFromGeminiParts(content?.parts);
  if (!text) throw new Error("Gemini returned no generated text.");
  const usage = geminiUsage(payload);
  return { provider: "gemini", model, text, ...(usage ? { usage } : {}) };
}

async function generateOllama(baseUrl: string, model: string, request: AiGenerationRequest): Promise<AiGenerationResult> {
  const response = await fetch(`${baseUrl}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, stream: false, messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }], options: { temperature: request.temperature ?? 0.7 } }) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Ollama request failed (${response.status}).`);
  const message = payload.message as Record<string, unknown> | undefined;
  const text = typeof message?.content === "string" ? message.content.trim() : "";
  if (!text) throw new Error("Ollama returned no generated text.");
  const usage = ollamaUsage(payload);
  return { provider: "ollama", model, text, ...(usage ? { usage } : {}) };
}

function chatUsage(payload: Record<string, unknown>): AiTokenUsage | undefined {
  const usage = payload.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
  const record = usage as Record<string, unknown>;
  return usageFromNumbers(record.prompt_tokens, record.completion_tokens, record.total_tokens);
}
function responsesUsage(payload: Record<string, unknown>): AiTokenUsage | undefined {
  const usage = payload.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
  const record = usage as Record<string, unknown>;
  return usageFromNumbers(record.input_tokens, record.output_tokens, record.total_tokens);
}
function anthropicUsage(payload: Record<string, unknown>): AiTokenUsage | undefined {
  const usage = payload.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
  const record = usage as Record<string, unknown>;
  return usageFromNumbers(record.input_tokens, record.output_tokens, undefined);
}
function geminiUsage(payload: Record<string, unknown>): AiTokenUsage | undefined {
  const usage = payload.usageMetadata;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
  const record = usage as Record<string, unknown>;
  return usageFromNumbers(record.promptTokenCount, record.candidatesTokenCount, record.totalTokenCount);
}
function ollamaUsage(payload: Record<string, unknown>): AiTokenUsage | undefined { return usageFromNumbers(payload.prompt_eval_count, payload.eval_count, undefined); }
function usageFromNumbers(input: unknown, output: unknown, total: unknown): AiTokenUsage | undefined {
  const inputTokens = finiteNonnegative(input);
  const outputTokens = finiteNonnegative(output);
  const totalTokens = finiteNonnegative(total) ?? (inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined);
  if (inputTokens === undefined || outputTokens === undefined || totalTokens === undefined) return undefined;
  return { inputTokens, outputTokens, totalTokens, source: "provider" };
}
function finiteNonnegative(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined; }
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
function textFromContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content.flatMap((part) => part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string" ? [String((part as Record<string, unknown>).text)] : []).join("\n").trim();
}
function textFromGeminiParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts.flatMap((part) => part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string" ? [String((part as Record<string, unknown>).text)] : []).join("\n").trim();
}
function anthropicError(payload: Record<string, unknown>): string | undefined {
  const error = payload.error;
  if (!error || typeof error !== "object" || Array.isArray(error)) return undefined;
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : undefined;
}
function geminiError(payload: Record<string, unknown>): string | undefined {
  const error = payload.error;
  if (!error || typeof error !== "object" || Array.isArray(error)) return undefined;
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : undefined;
}
