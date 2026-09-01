import type { AiModelCapabilities, AiModelResource } from "../application/ai-model-broker";

type SupportedProvider = "omniroute" | "9router" | "kings" | "openai" | "ollama";

const BASE_CAPABILITIES: Readonly<Record<SupportedProvider, AiModelCapabilities>> = {
  omniroute: { contextWindow: 128000, maxOutputTokens: 16000, streaming: true, creativeWriting: true, instructionFollowing: true, longContext: true },
  "9router": { contextWindow: 128000, maxOutputTokens: 16000, streaming: true, creativeWriting: true, instructionFollowing: true, longContext: true },
  kings: { contextWindow: 128000, maxOutputTokens: 16000, reasoning: true, vision: true, streaming: true, toolCalls: true, creativeWriting: true, instructionFollowing: true, longContext: true },
  openai: { contextWindow: 128000, maxOutputTokens: 16000, reasoning: true, vision: true, streaming: true, toolCalls: true, creativeWriting: true, instructionFollowing: true, longContext: true },
  ollama: { contextWindow: 32768, maxOutputTokens: 8192, creativeWriting: true, instructionFollowing: true },
};

/** Build the canonical broker resource registry from real runtime configuration only. */
export function discoverConfiguredAiModelResources(env: NodeJS.ProcessEnv = process.env): AiModelResource[] {
  const resources: AiModelResource[] = [];
  const addProvider = (provider: SupportedProvider, configured: boolean, models: readonly string[], prefix: string): void => {
    if (!configured) return;
    const uniqueModels = [...new Set(models.map((model) => model.trim()).filter(Boolean))];
    for (const model of uniqueModels) resources.push(withProviderMetrics({
      provider,
      model,
      configured: true,
      healthy: true,
      capabilities: { ...BASE_CAPABILITIES[provider] },
    }, env, prefix, uniqueModels.length === 1));
  };

  addProvider("omniroute", Boolean(env.OMNIROUTE_BASE_URL?.trim()), models(env.OMNIROUTE_MODELS, env.OMNIROUTE_MODEL, "auto"), "OMNIROUTE");
  addProvider("9router", Boolean(env.ROUTER9_BASE_URL?.trim()), models(env.ROUTER9_MODELS, env.ROUTER9_MODEL, "auto"), "ROUTER9");
  addProvider("kings", Boolean(env.KINGS_AI_ENDPOINT?.trim()), models(env.KINGS_AI_MODELS, env.KINGS_AI_MODEL), "KINGS_AI");
  addProvider("openai", Boolean(env.OPENAI_API_KEY?.trim()), models(env.OPENAI_MODELS, env.OPENAI_MODEL), "OPENAI");
  addProvider("ollama", Boolean(env.OLLAMA_BASE_URL?.trim()), models(env.OLLAMA_MODELS, env.OLLAMA_MODEL), "OLLAMA");

  const overrides = parseExplicitResources(env.AI_MODEL_RESOURCES_JSON, env);
  const byKey = new Map(resources.map((resource) => [`${resource.provider}::${resource.model}`, resource]));
  for (const resource of overrides) byKey.set(`${resource.provider}::${resource.model}`, resource);
  return [...byKey.values()].sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model));
}

function models(list: string | undefined, single: string | undefined, fallback?: string): string[] {
  const listed = list?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  if (listed.length) return listed;
  if (single?.trim()) return [single.trim()];
  return fallback ? [fallback] : [];
}

function withProviderMetrics(resource: AiModelResource, env: NodeJS.ProcessEnv, prefix: string, applySharedQuota: boolean): AiModelResource {
  const quotaLimit = applySharedQuota ? positive(env[`${prefix}_TOKEN_QUOTA`]) : undefined;
  const usedTokens = applySharedQuota ? nonnegative(env[`${prefix}_USED_TOKENS`]) : undefined;
  const remainingQuota = applySharedQuota ? nonnegative(env[`${prefix}_REMAINING_TOKENS`]) : undefined;
  const estimatedInputCostPerMillion = nonnegative(env[`${prefix}_INPUT_COST_PER_MILLION`]);
  const estimatedOutputCostPerMillion = nonnegative(env[`${prefix}_OUTPUT_COST_PER_MILLION`]);
  const quotaResetAt = applySharedQuota && validTimestamp(env[`${prefix}_QUOTA_RESET_AT`]) ? env[`${prefix}_QUOTA_RESET_AT`]!.trim() : undefined;
  return {
    ...resource,
    ...(quotaLimit !== undefined ? { quotaLimit } : {}),
    ...(usedTokens !== undefined ? { usedTokens } : {}),
    ...(remainingQuota !== undefined ? { remainingQuota } : {}),
    ...(quotaResetAt ? { quotaResetAt } : {}),
    ...(estimatedInputCostPerMillion !== undefined ? { estimatedInputCostPerMillion } : {}),
    ...(estimatedOutputCostPerMillion !== undefined ? { estimatedOutputCostPerMillion } : {}),
  };
}

function parseExplicitResources(raw: string | undefined, env: NodeJS.ProcessEnv): AiModelResource[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("AI_MODEL_RESOURCES_JSON must be valid JSON."); }
  if (!Array.isArray(parsed)) throw new Error("AI_MODEL_RESOURCES_JSON must be a JSON array.");
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`AI model resource ${index + 1} must be an object.`);
    const value = entry as Record<string, unknown>;
    const provider = supportedProvider(value.provider, index);
    if (!providerConfigured(provider, env)) throw new Error(`AI model resource ${provider}/${String(value.model ?? "")} has no configured provider endpoint/credential.`);
    const model = requiredString(value.model, `AI model resource ${index + 1} model`);
    const capabilities = value.capabilities && typeof value.capabilities === "object" && !Array.isArray(value.capabilities)
      ? { ...BASE_CAPABILITIES[provider], ...(value.capabilities as AiModelCapabilities) }
      : { ...BASE_CAPABILITIES[provider] };
    const resource: AiModelResource = {
      provider,
      model,
      configured: true,
      healthy: value.healthy !== false,
      capabilities,
      ...optionalNumberField(value, "estimatedInputCostPerMillion"),
      ...optionalNumberField(value, "estimatedOutputCostPerMillion"),
      ...optionalNumberField(value, "remainingQuota"),
      ...optionalNumberField(value, "usedTokens"),
      ...optionalNumberField(value, "quotaLimit"),
      ...optionalNumberField(value, "latencyMs"),
      ...optionalNumberField(value, "consecutiveFailures"),
      ...(typeof value.quotaResetAt === "string" && validTimestamp(value.quotaResetAt) ? { quotaResetAt: value.quotaResetAt } : {}),
      ...(typeof value.cooldownUntil === "string" && validTimestamp(value.cooldownUntil) ? { cooldownUntil: value.cooldownUntil } : {}),
    };
    return resource;
  });
}

function providerConfigured(provider: SupportedProvider, env: NodeJS.ProcessEnv): boolean {
  switch (provider) {
    case "omniroute": return Boolean(env.OMNIROUTE_BASE_URL?.trim());
    case "9router": return Boolean(env.ROUTER9_BASE_URL?.trim());
    case "kings": return Boolean(env.KINGS_AI_ENDPOINT?.trim());
    case "openai": return Boolean(env.OPENAI_API_KEY?.trim());
    case "ollama": return Boolean(env.OLLAMA_BASE_URL?.trim());
  }
}

function supportedProvider(value: unknown, index: number): SupportedProvider {
  const provider = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (provider === "omniroute" || provider === "9router" || provider === "kings" || provider === "openai" || provider === "ollama") return provider;
  throw new Error(`AI model resource ${index + 1} has unsupported provider "${provider}".`);
}

function optionalNumberField(value: Record<string, unknown>, key: keyof AiModelResource): Partial<AiModelResource> {
  const raw = value[key as string];
  if (raw === undefined) return {};
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) throw new Error(`AI model resource ${String(key)} must be a non-negative finite number.`);
  return { [key]: raw } as Partial<AiModelResource>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function positive(value: string | undefined): number | undefined { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined; }
function nonnegative(value: string | undefined): number | undefined { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined; }
function validTimestamp(value: string | undefined): boolean { return Boolean(value?.trim() && Number.isFinite(Date.parse(value))); }
