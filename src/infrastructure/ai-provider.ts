import { buildProjectContext } from "../application/context-pipeline";
import type { ProjectBrainQuery } from "../application/project-brain";
import type { ProjectMemoryStore } from "../application/project-memory-store";
import { optimizeContext } from "../application/context-optimizer";
import { generateWithKingsAi } from "./kings-ai-bridge";

export interface AiGenerationRequest { readonly system: string; readonly user: string; readonly temperature?: number; readonly maxOutputTokens?: number; }
export interface AiGenerationResult { readonly provider: "openai" | "ollama" | "kings"; readonly model: string; readonly text: string; readonly requestId?: string; readonly optimization?: { readonly originalEstimatedTokens: number; readonly optimizedEstimatedTokens: number; readonly tokensSaved: number; readonly compressionRatio: number; readonly strategy: readonly string[]; }; }

export interface ProjectAiGenerationRequest extends Omit<AiGenerationRequest, "system"> {
  readonly system?: string;
  readonly memory: ProjectMemoryStore;
  readonly context: ProjectBrainQuery;
  readonly contextBudget?: number;
}

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

  const kingsEndpoint = process.env.KINGS_AI_ENDPOINT?.trim();
  if (kingsEndpoint) return { ...(await generateWithKingsAi({ endpoint: kingsEndpoint }, optimizedRequest)), optimization };

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) return { ...(await generateOpenAi(openAiKey, optimizedRequest)), optimization };
  const ollama = process.env.OLLAMA_BASE_URL?.trim();
  if (ollama) return { ...(await generateOllama(ollama.replace(/\/$/, ""), optimizedRequest)), optimization };
  throw new Error("No AI provider is configured. Set KINGS_AI_ENDPOINT + KINGS_AI_MODEL, OPENAI_API_KEY + OPENAI_MODEL, or OLLAMA_BASE_URL + OLLAMA_MODEL.");
}

export async function generateProjectText(request: ProjectAiGenerationRequest): Promise<AiGenerationResult> {
  const projectContext = buildProjectContext(request.memory, {
    query: request.context,
    budget: request.contextBudget ?? readPositiveInteger(process.env.AI_CONTEXT_MAX_INPUT_TOKENS),
  });
  const system = [request.system?.trim(), projectContext.system].filter(Boolean).join("\n\n");
  const result = await generateText({
    system,
    user: request.user,
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
  });
  if (!result.optimization) return result;
  return {
    ...result,
    optimization: {
      ...result.optimization,
      originalEstimatedTokens: projectContext.originalEstimatedTokens,
      optimizedEstimatedTokens: result.optimization.optimizedEstimatedTokens,
      tokensSaved: projectContext.tokensSaved + result.optimization.tokensSaved,
      compressionRatio: projectContext.optimizedEstimatedTokens > 0
        ? result.optimization.optimizedEstimatedTokens / projectContext.originalEstimatedTokens
        : result.optimization.compressionRatio,
      strategy: [...projectContext.strategies, ...result.optimization.strategy],
    },
  };
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function generateOpenAi(apiKey: string, request: AiGenerationRequest): Promise<AiGenerationResult> {
  const model = process.env.OPENAI_MODEL?.trim();
  if (!model) throw new Error("OPENAI_MODEL is required when OPENAI_API_KEY is configured.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, input: [{ role: "system", content: request.system }, { role: "user", content: request.user }], temperature: request.temperature ?? 0.7, max_output_tokens: request.maxOutputTokens ?? 4000 })
  });
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
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") parts.push(String((part as Record<string, unknown>).text));
    }
  }
  return parts.join("\n").trim();
}
