import type { AiGenerationRequest, AiGenerationResult, AiTokenUsage } from "./ai-provider";

export interface KingsAiBridgeConfig {
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly model?: string;
}

/**
 * Optional bridge for a running K.I.N.G.S. deployment that exposes an
 * OpenAI-Responses-compatible HTTP endpoint. Forge remains functional without it.
 * The endpoint is explicit so Forge never assumes a K.I.N.G.S. runtime transport.
 */
export async function generateWithKingsAi(config: KingsAiBridgeConfig, request: AiGenerationRequest): Promise<AiGenerationResult> {
  const endpoint = config.endpoint.trim();
  if (!endpoint) throw new Error("KINGS_AI_ENDPOINT is required when K.I.N.G.S. is selected.");
  const model = config.model?.trim() || process.env.KINGS_AI_MODEL?.trim();
  if (!model) throw new Error("KINGS_AI_MODEL is required when K.I.N.G.S. is selected.");

  const headers: Record<string, string> = { "content-type": "application/json" };
  const apiKey = config.apiKey?.trim() || process.env.KINGS_AI_API_KEY?.trim();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      temperature: request.temperature ?? 0.7,
      max_output_tokens: request.maxOutputTokens ?? 4000,
    }),
  });

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`K.I.N.G.S. request failed (${response.status}).`);

  const text = extractText(payload);
  if (!text) throw new Error("K.I.N.G.S. returned no generated text.");
  const usage = extractUsage(payload);
  return { provider: "kings", model, text, requestId: typeof payload.id === "string" ? payload.id : undefined, ...(usage ? { usage } : {}) };
}

function extractText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") {
        parts.push(String((part as Record<string, unknown>).text));
      }
    }
  }
  return parts.join("\n").trim();
}

function extractUsage(payload: Record<string, unknown>): AiTokenUsage | undefined {
  const usage = payload.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
  const record = usage as Record<string, unknown>;
  const inputTokens = numeric(record.input_tokens ?? record.prompt_tokens);
  const outputTokens = numeric(record.output_tokens ?? record.completion_tokens);
  const totalTokens = numeric(record.total_tokens) ?? (inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined);
  if (inputTokens === undefined || outputTokens === undefined || totalTokens === undefined) return undefined;
  return { inputTokens, outputTokens, totalTokens, source: "provider" };
}

function numeric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
}
