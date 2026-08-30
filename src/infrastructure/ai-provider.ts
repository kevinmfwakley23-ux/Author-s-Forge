import { buildProjectContext } from "../application/context-pipeline";
import type { ProjectBrainQuery } from "../application/project-brain";
import type { ProjectMemoryStore } from "../application/project-memory-store";
import { estimateTokens, optimizeContext } from "../application/context-optimizer";
import { SemanticCache, stableCacheKey } from "../application/semantic-cache";
import { generateWithKingsAi } from "./kings-ai-bridge";

export interface AiGenerationRequest { readonly system: string; readonly user: string; readonly temperature?: number; readonly maxOutputTokens?: number; }
export interface AiGenerationResult { readonly provider: "omniroute" | "openai" | "ollama" | "kings"; readonly model: string; readonly text: string; readonly requestId?: string; readonly cacheHit?: boolean; readonly optimization?: { readonly originalEstimatedTokens: number; readonly optimizedEstimatedTokens: number; readonly tokensSaved: number; readonly compressionRatio: number; readonly strategy: readonly string[]; }; }

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

export async function generateText(request: AiGenerationRequest): Promise<AiGenerationResult> {
  const optimized = optimizeContext({
    system: request.system,
    user: request.user,
    maxInputTokens: readPositiveInteger(process.env.AI_CONTEXT_MAX_INPUT_TOKENS),
  });
  const optimizedRequest = { ...request, system: optimized.system, user: optimized.user };
  const optimization = {
    originalEstimatedTokens: optimized.originalEstimatedTokens,
    optimizedEstimatedTokens: optimized.optimizedEstimatedTokens,
    tokensSaved: optimized.tokensSaved,
    compressionRatio: optimized.compressionRatio,
    strategy: optimized.strategy,
  };

  const cacheEnabled = process.env.AI_CACHE_ENABLED?.trim().toLowerCase() === "true";
  const cacheable = cacheEnabled && (request.temperature ?? 0.7) === 0;
  const cacheKey = cacheable ? stableCacheKey([
    "forge-ai-v2",
    optimizedRequest.system,
    optimizedRequest.user,
    request.temperature ?? 0.7,
    request.maxOutputTokens ?? 4000,
    process.env.OMNIROUTE_MODEL?.trim() ?? "",
    process.env.KINGS_AI_MODEL?.trim() ?? "",
    process.env.OPENAI_MODEL?.trim() ?? "",
    process.env.OLLAMA_MODEL?.trim() ?? "",
  ]) : undefined;
  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached) return { ...cached, cacheHit: true, optimization };
  }

  let result: AiGenerationResult;
  const omniRouteEndpoint = process.env.OMNIROUTE_BASE_URL?.trim();
  if (omniRouteEndpoint) result = await generateWithOpenAiCompatibleGateway("omniroute", omniRouteEndpoint, process.env.OMNIROUTE_API_KEY?.trim(), optimizedRequest, process.env.OMNIROUTE_MODEL?.trim());
  else {
    const kingsEndpoint = process.env.KINGS_AI_ENDPOINT?.trim();
    if (kingsEndpoint) result = await generateWithKingsAi({ endpoint: kingsEndpoint }, optimizedRequest);
    else {
      const openAiKey = process.env.OPENAI_API_KEY?.trim();
      if (openAiKey) result = await generateOpenAi(openAiKey, optimizedRequest);
      else {
        const ollama = process.env.OLLAMA_BASE_URL?.trim();
        if (ollama) result = await generateOllama(ollama.replace(/\/$/, ""), optimizedRequest);
        else throw new Error("No AI provider is configured. Set OMNIROUTE_BASE_URL + OMNIROUTE_MODEL, KINGS_AI_ENDPOINT + KINGS_AI_MODEL, OPENAI_API_KEY + OPENAI_MODEL, or OLLAMA_BASE_URL + OLLAMA_MODEL.");
      }
    }
  }

  const finalResult = { ...result, cacheHit: false, optimization };
  if (cacheKey) responseCache.set(cacheKey, finalResult);
  return finalResult;
}

export async function generateProjectText(request: ProjectAiGenerationRequest): Promise<AiGenerationResult> {
  const projectContext = buildProjectContext(request.memory, {
    query: request.context,
    budget: request.contextBudget ?? readPositiveInteger(process.env.AI_CONTEXT_MAX_INPUT_TOKENS),
  });
  const system = [request.system?.trim(), projectContext.system].filter(Boolean).join("\n\n");
  const result = await generateText({ system, user: request.user, temperature: request.temperature, maxOutputTokens: request.maxOutputTokens });
  if (!result.optimization) return result;

  const originalEstimatedTokens = projectContext.originalEstimatedTokens + estimateTokens([request.system?.trim(), request.user].filter(Boolean).join("\n\n"));
  const optimizedEstimatedTokens = result.optimization.optimizedEstimatedTokens;
  const tokensSaved = Math.max(0, originalEstimatedTokens - optimizedEstimatedTokens);
  return { ...result, optimization: { originalEstimatedTokens, optimizedEstimatedTokens, tokensSaved, compressionRatio: originalEstimatedTokens > 0 ? optimizedEstimatedTokens / originalEstimatedTokens : 1, strategy: [...projectContext.strategies, ...result.optimization.strategy] } };
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function generateWithOpenAiCompatibleGateway(provider: "omniroute", baseUrl: string, apiKey: string | undefined, request: AiGenerationRequest, configuredModel: string | undefined): Promise<AiGenerationResult> {
  const model = configuredModel?.trim();
  if (!model) throw new Error("OMNIROUTE_MODEL is required when OMNIROUTE_BASE_URL is configured.");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ model, messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }], temperature: request.temperature ?? 0.7, ...(request.maxOutputTokens ? { max_tokens: request.maxOutputTokens } : {}) }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "object" && payload.error ? String((payload.error as Record<string, unknown>).message ?? `OmniRoute request failed (${response.status}).`) : `OmniRoute request failed (${response.status}).`);
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const text = typeof message?.content === "string" ? message.content.trim() : "";
  if (!text) throw new Error("OmniRoute returned no generated text.");
  return { provider, model, text, requestId: typeof payload.id === "string" ? payload.id : undefined };
}

async function generateOpenAi(apiKey: string, request: AiGenerationRequest): Promise<AiGenerationResult> {
  const model = process.env.OPENAI_MODEL?.trim();
  if (!model) throw new Error("OPENAI_MODEL is required when OPENAI_API_KEY is configured.");
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model, input: [{ role: "system", content: request.system }, { role: "user", content: request.user }], temperature: request.temperature ?? 0.7, max_output_tokens: request.maxOutputTokens ?? 4000 }) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "object" && payload.error ? String((payload.error as Record<string, unknown>).message ?? `OpenAI request failed (${response.status}).`) : `OpenAI request failed (${response.status}).`);
  const text = extractOpenAiText(payload);
  if (!text) throw new Error("OpenAI returned no generated text.");
  return { provider: "openai", model, text, requestId: typeof payload.id === "string" ? payload.id : undefined };
}

async function generateOllama(baseUrl: string, request: AiGenerationRequest): Promise<AiGenerationResult> {
  const model = process.env.OLLAMA_MODEL?.trim();
  if (!model) throw new Error("OLLAMA_MODEL is required when OLLAMA_BASE_URL is configured.");
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
