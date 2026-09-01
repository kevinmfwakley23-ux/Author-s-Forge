import type { AiModelCapabilities, AiModelResource } from "../application/ai-model-broker";

type SupportedProvider = "omniroute" | "9router" | "kings" | "openai" | "ollama";

/**
 * Provider discovery must not invent model-specific context windows, output
 * ceilings, vision/tool/reasoning support, or long-context status. Those vary
 * by concrete model and belong in explicit resource metadata when known.
 *
 * These two baseline flags describe the minimum text-chat behavior required by
 * Forge's currently supported provider adapters; advanced capabilities remain
 * unknown until configured.
 */
const BASE_CAPABILITIES: Readonly<Record<SupportedProvider, AiModelCapabilities>> = {
  omniroute: { creativeWriting: true, instructionFollowing: true },
  "9router": { creativeWriting: true, instructionFollowing: true },
  kings: { creativeWriting: true, instructionFollowing: true },
  openai: { creativeWriting: true, instructionFollowing: true },
  ollama: { creativeWriting: true, instructionFollowing: true },
};

const BOOLEAN_CAPABILITIES = ["reasoning", "vision", "streaming", "toolCalls", "creativeWriting", "instructionFollowing", "longContext"] as const;
const NUMERIC_CAPABILITIES = ["contextWindow", "maxOutputTokens"] as const;

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

  // Preserve canonical discovery order as a stable soft preference. The broker
  // may rotate away for quota, usage balance, cooldown, health, capability,
  // latency or cost.
  addProvider("omniroute", Boolean(env.OMNIROUTE_BASE_URL?.trim()), models(env.OMNIROUTE_MODELS, env.OMNIROUTE_MODEL, "auto"), "OMNIROUTE");
  addProvider("9router", Boolean(env.ROUTER9_BASE_URL?.trim()), models(env.ROUTER9_MODELS, env.ROUTER9_MODEL, "auto"), "ROUTER9");
  addProvider("kings", Boolean(env.KINGS_AI_ENDPOINT?.trim()), models(env.KINGS_AI_MODELS, env.KINGS_AI_MODEL), "KINGS_AI");
  addProvider("openai", Boolean(env.OPENAI_API_KEY?.trim()), models(env.OPENAI_MODELS, env.OPENAI_MODEL), "OPENAI");
  addProvider("ollama", Boolean(env.OLLAMA_BASE_URL?.trim()), models(env.OLLAMA_MODELS, env.OLLAMA_MODEL), "OLLAMA");

  const overrides = parseExplicitResources(env.AI_MODEL_RESOURCES_JSON, env);
  const byKey = new Map(resources.map((resource) => [`${resource.provider}::${resource.model}`, resource]));
  for (const resource of overrides) byKey.set(`${resource.provider}::${resource.model}`, resource);
  return [...byKey.values()];
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
  const rawReset = applySharedQuota ? env[`${prefix}_QUOTA_RESET_AT`] : undefined;
  if (rawReset?.trim() && !validTimestamp(rawReset)) throw new Error(`${prefix}_QUOTA_RESET_AT must be a valid timestamp.`);
  const quotaResetAt = rawReset?.trim();
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
    if (value.healthy !== undefined && typeof value.healthy !== "boolean") throw new Error(`AI model resource ${provider}/${model} healthy must be boolean.`);
    const quotaResetAt = optionalTimestamp(value.quotaResetAt, `AI model resource ${provider}/${model} quotaResetAt`);
    const cooldownUntil = optionalTimestamp(value.cooldownUntil, `AI model resource ${provider}/${model} cooldownUntil`);
    const resource: AiModelResource = {
      provider,
      model,
      configured: true,
      healthy: value.healthy !== false,
      capabilities: parseCapabilities(value.capabilities, provider, model),
      ...optionalNumberField(value, "estimatedInputCostPerMillion"),
      ...optionalNumberField(value, "estimatedOutputCostPerMillion"),
      ...optionalNumberField(value, "remainingQuota"),
      ...optionalNumberField(value, "usedTokens"),
      ...optionalNumberField(value, "quotaLimit"),
      ...optionalNumberField(value, "latencyMs"),
      ...optionalNumberField(value, "consecutiveFailures"),
      ...(quotaResetAt ? { quotaResetAt } : {}),
      ...(cooldownUntil ? { cooldownUntil } : {}),
    };
    return resource;
  });
}

function parseCapabilities(raw: unknown, provider: SupportedProvider, model: string): AiModelCapabilities {
  if (raw === undefined) return { ...BASE_CAPABILITIES[provider] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`AI model resource ${provider}/${model} capabilities must be an object.`);
  const value = raw as Record<string, unknown>;
  const allowed = new Set<string>([...BOOLEAN_CAPABILITIES, ...NUMERIC_CAPABILITIES]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`AI model resource ${provider}/${model} has unsupported capability "${key}".`);
  const capabilities: Record<string, boolean | number> = { ...BASE_CAPABILITIES[provider] };
  for (const key of BOOLEAN_CAPABILITIES) {
    const candidate = value[key];
    if (candidate === undefined) continue;
    if (typeof candidate !== "boolean") throw new Error(`AI model resource ${provider}/${model} capability ${key} must be boolean.`);
    capabilities[key] = candidate;
  }
  for (const key of NUMERIC_CAPABILITIES) {
    const candidate = value[key];
    if (candidate === undefined) continue;
    if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate <= 0) throw new Error(`AI model resource ${provider}/${model} capability ${key} must be a positive finite number.`);
    capabilities[key] = candidate;
  }
  return capabilities as AiModelCapabilities;
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

function optionalTimestamp(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !validTimestamp(value)) throw new Error(`${label} must be a valid timestamp.`);
  return value.trim();
}
function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function positive(value: string | undefined): number | undefined { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined; }
function nonnegative(value: string | undefined): number | undefined { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined; }
function validTimestamp(value: string | undefined): boolean { return Boolean(value?.trim() && Number.isFinite(Date.parse(value))); }
