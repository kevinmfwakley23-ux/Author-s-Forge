import type { AiGenerationRequest, AiGenerationResult, AiTokenUsage } from "./ai-provider";
import { providerFetch } from "./provider-transport";

export interface KingsAiBridgeConfig {
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly model?: string;
}

/**
 * Resolve the explicit K.I.N.G.S. Responses route used by Forge.
 *
 * A normal URL must already point at /responses or /v1/responses so the owner
 * runtime can never be mistaken for a generic text endpoint. Render private
 * services expose an internal `host:port` value rather than a URL; that exact
 * form is accepted and expanded to `http://host:port/v1/responses`.
 */
export function resolveKingsAiResponsesEndpoint(value: string): string {
  const raw = value.trim().replace(/\/+$/, "");
  if (!raw) throw new Error("KINGS_AI_RESPONSES_URL is required when K.I.N.G.S. is selected as a text provider.");

  if (/^https?:\/\//i.test(raw)) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("KINGS_AI_RESPONSES_URL must be a valid HTTP(S) URL or private host:port value.");
    }
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("KINGS_AI_RESPONSES_URL must be a clean HTTP(S) Responses endpoint without credentials, query parameters, or fragments.");
    }
    if (!/\/(?:v1\/)?responses$/i.test(parsed.pathname.replace(/\/+$/, ""))) {
      throw new Error("K.I.N.G.S. text generation requires an explicit Responses-compatible /responses endpoint. The K.I.N.G.S. owner/coding-machine root is not a generic text-generation API.");
    }
    return raw;
  }

  const hostPort = parsePrivateHostPort(raw);
  if (hostPort) return `http://${hostPort}/v1/responses`;

  throw new Error("K.I.N.G.S. text generation requires an explicit Responses-compatible /responses endpoint or a private host:port service address. The K.I.N.G.S. owner/coding-machine root is not a generic text-generation API.");
}

/**
 * Optional text-generation bridge for a K.I.N.G.S. deployment that explicitly
 * exposes an OpenAI-Responses-compatible endpoint. The normal K.I.N.G.S. owner
 * runtime (:8787) is an orchestrator API and is intentionally NOT treated as
 * this protocol unless a real /responses route is deployed.
 */
export async function generateWithKingsAi(config: KingsAiBridgeConfig, request: AiGenerationRequest): Promise<AiGenerationResult> {
  const endpoint = resolveKingsAiResponsesEndpoint(config.endpoint);
  const model = config.model?.trim() || process.env.KINGS_AI_MODEL?.trim();
  if (!model) throw new Error("KINGS_AI_MODEL is required when K.I.N.G.S. is selected.");

  const headers: Record<string, string> = { "content-type": "application/json" };
  const apiKey = config.apiKey?.trim() || process.env.KINGS_AI_API_KEY?.trim();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const response = await providerFetch(endpoint, {
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
  }, {
    timeoutMs: readTimeout(process.env.KINGS_AI_TIMEOUT_MS),
    label: "K.I.N.G.S.",
  });

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const detail = providerError(payload);
    throw new Error(`K.I.N.G.S. request failed (${response.status})${detail ? `: ${detail}` : "."}`);
  }

  const text = extractText(payload);
  if (!text) throw new Error("K.I.N.G.S. returned no generated text.");
  const usage = extractUsage(payload);
  return { provider: "kings", model, text, requestId: typeof payload.id === "string" ? payload.id : undefined, ...(usage ? { usage } : {}) };
}

function parsePrivateHostPort(value: string): string | undefined {
  if (!value || /[\s/?#@]/.test(value)) return undefined;
  const separator = value.lastIndexOf(":");
  if (separator < 1 || separator === value.length - 1) return undefined;

  const host = value.slice(0, separator);
  const portText = value.slice(separator + 1);
  if (!/^\d{1,5}$/.test(portText)) return undefined;
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return undefined;

  if (host.startsWith("[") || host.endsWith("]")) {
    if (!/^\[[0-9a-f:]+\]$/i.test(host)) return undefined;
  } else if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host) || host.includes("..")) {
    return undefined;
  }

  return `${host}:${port}`;
}

function readTimeout(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 600_000) throw new Error("KINGS_AI_TIMEOUT_MS must be an integer from 1000 to 600000.");
  return parsed;
}

function providerError(payload: Record<string, unknown>): string | undefined {
  const error = payload.error;
  if (typeof error === "string" && error.trim()) return error.trim().slice(0, 500);
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message.trim().slice(0, 500);
  }
  const message = payload.message;
  return typeof message === "string" && message.trim() ? message.trim().slice(0, 500) : undefined;
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
      if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") parts.push(String((part as Record<string, unknown>).text));
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
