import type { AiBillingClass, AiModelCapabilities, AiModelResource, AiProviderQuota } from "../application/ai-model-broker";
import { constrainResourcesForOwnerPin, refreshPersistedAiOwnerControl } from "./ai-owner-control-runtime";
import { discoverOpenAiCompatibleGatewayResources } from "./openai-compatible-gateways";

type SupportedProvider = "omniroute" | "9router" | "kings" | "openai" | "ollama" | "groq" | "mistral" | "gemini" | "anthropic" | "openrouter";

const BASE_CAPABILITIES: Readonly<Record<SupportedProvider, AiModelCapabilities>> = {
  omniroute: { creativeWriting: true, instructionFollowing: true },
  "9router": { creativeWriting: true, instructionFollowing: true },
  kings: { creativeWriting: true, instructionFollowing: true },
  openai: { creativeWriting: true, instructionFollowing: true },
  ollama: { creativeWriting: true, instructionFollowing: true },
  groq: { creativeWriting: true, instructionFollowing: true },
  mistral: { creativeWriting: true, instructionFollowing: true },
  gemini: { creativeWriting: true, instructionFollowing: true },
  anthropic: { creativeWriting: true, instructionFollowing: true },
  openrouter: { creativeWriting: true, instructionFollowing: true },
};

const DEFAULT_BILLING: Readonly<Record<SupportedProvider, AiBillingClass>> = {
  ollama: "local",
  // K.I.N.G.S. may be local, LAN-hosted, or backed by paid gateways. Never infer free/local from its name.
  kings: "unknown",
  omniroute: "gateway-managed",
  "9router": "gateway-managed",
  openai: "metered",
  groq: "unknown",
  mistral: "unknown",
  gemini: "unknown",
  anthropic: "metered",
  openrouter: "gateway-managed",
};

const BOOLEAN_CAPABILITIES = ["reasoning", "vision", "streaming", "toolCalls", "creativeWriting", "instructionFollowing", "longContext"] as const;
const NUMERIC_CAPABILITIES = ["contextWindow", "maxOutputTokens"] as const;
const BILLING_CLASSES: readonly AiBillingClass[] = ["local", "subscription", "free", "metered", "gateway-managed", "unknown"];

export function discoverConfiguredAiModelResources(env: NodeJS.ProcessEnv = process.env): AiModelResource[] {
  const ownerControl = refreshPersistedAiOwnerControl(env);
  const resources: AiModelResource[] = [];
  const quotaScopes = new Set(discoverConfiguredAiProviderQuotas(env).map((quota) => quota.scope));
  const addProvider = (provider: SupportedProvider, configured: boolean, candidateModels: readonly string[], prefix: string): void => {
    if (!configured) return;
    const pinnedModel = env.AI_PINNED_PROVIDER === provider ? env.AI_PINNED_MODEL?.trim() : undefined;
    const uniqueModels = [...new Set([...(pinnedModel ? [pinnedModel] : []), ...candidateModels].map((model) => model.trim()).filter(Boolean))];
    const billingClass = billingClassFromEnv(env[`${prefix}_BILLING_CLASS`], DEFAULT_BILLING[provider], prefix);
    for (const model of uniqueModels) {
      resources.push(withProviderMetrics({
        provider,
        model,
        configured: true,
        healthy: true,
        billingClass,
        capabilities: { ...BASE_CAPABILITIES[provider] },
        ...(quotaScopes.has(provider) ? { quotaScope: provider } : {}),
      }, env, prefix));
    }
  };

  const kingsTextEndpoint = kingsResponsesEndpoint(env);

  addProvider("omniroute", Boolean(env.OMNIROUTE_BASE_URL?.trim()), models(env.OMNIROUTE_MODELS, env.OMNIROUTE_MODEL, "auto"), "OMNIROUTE");
  addProvider("9router", Boolean(env.ROUTER9_BASE_URL?.trim()), models(env.ROUTER9_MODELS, env.ROUTER9_MODEL), "ROUTER9");
  addProvider("openai", Boolean(env.OPENAI_API_KEY?.trim()), models(env.OPENAI_MODELS, env.OPENAI_MODEL), "OPENAI");
  addProvider("ollama", Boolean(env.OLLAMA_BASE_URL?.trim()), models(env.OLLAMA_MODELS, env.OLLAMA_MODEL), "OLLAMA");
  // The K.I.N.G.S. owner/coding-machine URL (normally :8787) is an orchestrator API, not a Responses endpoint.
  // It must not create a generic text-model resource. Use KINGS_AI_RESPONSES_URL for a real compatible endpoint.
  addProvider("kings", Boolean(kingsTextEndpoint), models(env.KINGS_AI_MODELS, env.KINGS_AI_MODEL), "KINGS_AI");
  addProvider("groq", Boolean(env.GROQ_API_KEY?.trim()), models(env.GROQ_MODELS, env.GROQ_MODEL), "GROQ");
  addProvider("mistral", Boolean(env.MISTRAL_API_KEY?.trim()), models(env.MISTRAL_MODELS, env.MISTRAL_MODEL), "MISTRAL");
  addProvider("gemini", Boolean(env.GEMINI_API_KEY?.trim()), models(env.GEMINI_MODELS, env.GEMINI_MODEL), "GEMINI");
  addProvider("anthropic", Boolean(env.ANTHROPIC_API_KEY?.trim()), models(env.ANTHROPIC_MODELS, env.ANTHROPIC_MODEL), "ANTHROPIC");
  addProvider("openrouter", Boolean(env.OPENROUTER_API_KEY?.trim()), models(env.OPENROUTER_MODELS, env.OPENROUTER_MODEL), "OPENROUTER");

  // Generic OpenAI-compatible gateways are durable registry entries. Their
  // credential values stay in environment secrets and are never copied into
  // the project/model resource ledger.
  resources.push(...discoverOpenAiCompatibleGatewayResources(env));

  const overrides = parseExplicitResources(env.AI_MODEL_RESOURCES_JSON, env);
  const byKey = new Map(resources.map((resource) => [`${resource.provider}::${resource.model}`, resource]));
  for (const resource of overrides) {
    const quotaScope = quotaScopes.has(resource.provider) ? resource.provider : undefined;
    byKey.set(`${resource.provider}::${resource.model}`, { ...resource, ...(quotaScope ? { quotaScope } : {}) });
  }
  return constrainResourcesForOwnerPin([...byKey.values()], ownerControl);
}

/**
 * Provider/account quota discovery is intentionally separate from model
 * discovery. One OMNIROUTE_TOKEN_QUOTA or ROUTER9_TOKEN_QUOTA represents one
 * shared allowance regardless of how many models are configured behind it.
 */
export function discoverConfiguredAiProviderQuotas(env: NodeJS.ProcessEnv = process.env): AiProviderQuota[] {
  const definitions: readonly [SupportedProvider, boolean, string][] = [
    ["omniroute", Boolean(env.OMNIROUTE_BASE_URL?.trim()), "OMNIROUTE"],
    ["9router", Boolean(env.ROUTER9_BASE_URL?.trim()), "ROUTER9"],
    ["openai", Boolean(env.OPENAI_API_KEY?.trim()), "OPENAI"],
    ["ollama", Boolean(env.OLLAMA_BASE_URL?.trim()), "OLLAMA"],
    ["kings", Boolean(kingsResponsesEndpoint(env)), "KINGS_AI"],
    ["groq", Boolean(env.GROQ_API_KEY?.trim()), "GROQ"],
    ["mistral", Boolean(env.MISTRAL_API_KEY?.trim()), "MISTRAL"],
    ["gemini", Boolean(env.GEMINI_API_KEY?.trim()), "GEMINI"],
    ["anthropic", Boolean(env.ANTHROPIC_API_KEY?.trim()), "ANTHROPIC"],
    ["openrouter", Boolean(env.OPENROUTER_API_KEY?.trim()), "OPENROUTER"],
  ];
  const quotas: AiProviderQuota[] = [];
  for (const [provider, configured, prefix] of definitions) {
    if (!configured) continue;
    const quota = providerQuotaFromEnv(provider, prefix, env);
    if (quota) quotas.push(quota);
  }
  return quotas;
}

function kingsResponsesEndpoint(env: NodeJS.ProcessEnv): string | undefined {
  const explicit = env.KINGS_AI_RESPONSES_URL?.trim();
  if (explicit) return explicit;
  const legacy = env.KINGS_AI_ENDPOINT?.trim();
  return legacy && /\/(?:v1\/)?responses\/?$/i.test(legacy) ? legacy : undefined;
}

function models(list: string | undefined, single: string | undefined, fallback?: string): string[] {
  const listed = list?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  if (listed.length) return listed;
  if (single?.trim()) return [single.trim()];
  return fallback ? [fallback] : [];
}

function withProviderMetrics(resource: AiModelResource, env: NodeJS.ProcessEnv, prefix: string): AiModelResource {
  const estimatedInputCostPerMillion = nonnegative(env[`${prefix}_INPUT_COST_PER_MILLION`]);
  const estimatedOutputCostPerMillion = nonnegative(env[`${prefix}_OUTPUT_COST_PER_MILLION`]);
  return {
    ...resource,
    ...(estimatedInputCostPerMillion !== undefined ? { estimatedInputCostPerMillion } : {}),
    ...(estimatedOutputCostPerMillion !== undefined ? { estimatedOutputCostPerMillion } : {}),
  };
}

function providerQuotaFromEnv(provider: SupportedProvider, prefix: string, env: NodeJS.ProcessEnv): AiProviderQuota | undefined {
  const quotaLimit = positive(env[`${prefix}_TOKEN_QUOTA`]);
  const usedTokens = nonnegative(env[`${prefix}_USED_TOKENS`]);
  const remainingQuota = nonnegative(env[`${prefix}_REMAINING_TOKENS`]);
  const rawReset = env[`${prefix}_QUOTA_RESET_AT`];
  if (rawReset?.trim() && !validTimestamp(rawReset)) throw new Error(`${prefix}_QUOTA_RESET_AT must be a valid timestamp.`);
  const quotaResetAt = rawReset?.trim();
  if (quotaLimit === undefined && usedTokens === undefined && remainingQuota === undefined && !quotaResetAt) return undefined;
  return {
    scope: provider,
    provider,
    ...(quotaLimit !== undefined ? { quotaLimit } : {}),
    ...(usedTokens !== undefined ? { usedTokens } : {}),
    ...(remainingQuota !== undefined ? { remainingQuota } : {}),
    ...(quotaResetAt ? { quotaResetAt } : {}),
  };
}

function parseExplicitResources(raw: string | undefined, env: NodeJS.ProcessEnv): AiModelResource[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("AI_MODEL_RESOURCES_JSON must be valid JSON."); }
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
    return { provider, model, configured: true, healthy: value.healthy !== false, billingClass: parseBillingClass(value.billingClass, DEFAULT_BILLING[provider], `AI model resource ${provider}/${model}`), capabilities: parseCapabilities(value.capabilities, provider, model), ...optionalNumberField(value, "estimatedInputCostPerMillion"), ...optionalNumberField(value, "estimatedOutputCostPerMillion"), ...optionalNumberField(value, "remainingQuota"), ...optionalNumberField(value, "usedTokens"), ...optionalNumberField(value, "quotaLimit"), ...optionalNumberField(value, "latencyMs"), ...optionalNumberField(value, "consecutiveFailures"), ...(quotaResetAt ? { quotaResetAt } : {}), ...(cooldownUntil ? { cooldownUntil } : {}) } as AiModelResource;
  });
}

function parseCapabilities(raw: unknown, provider: SupportedProvider, model: string): AiModelCapabilities {
  if (raw === undefined) return { ...BASE_CAPABILITIES[provider] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`AI model resource ${provider}/${model} capabilities must be an object.`);
  const value = raw as Record<string, unknown>;
  const allowed = new Set<string>([...BOOLEAN_CAPABILITIES, ...NUMERIC_CAPABILITIES]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`AI model resource ${provider}/${model} has unsupported capability "${key}".`);
  const capabilities: Record<string, boolean | number> = { ...BASE_CAPABILITIES[provider] };
  for (const key of BOOLEAN_CAPABILITIES) { const candidate = value[key]; if (candidate === undefined) continue; if (typeof candidate !== "boolean") throw new Error(`AI model resource ${provider}/${model} capability ${key} must be boolean.`); capabilities[key] = candidate; }
  for (const key of NUMERIC_CAPABILITIES) { const candidate = value[key]; if (candidate === undefined) continue; if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate <= 0) throw new Error(`AI model resource ${provider}/${model} capability ${key} must be a positive finite number.`); capabilities[key] = candidate; }
  return capabilities as AiModelCapabilities;
}

function providerConfigured(provider: SupportedProvider, env: NodeJS.ProcessEnv): boolean {
  switch (provider) {
    case "omniroute": return Boolean(env.OMNIROUTE_BASE_URL?.trim());
    case "9router": return Boolean(env.ROUTER9_BASE_URL?.trim());
    case "kings": return Boolean(kingsResponsesEndpoint(env));
    case "openai": return Boolean(env.OPENAI_API_KEY?.trim());
    case "ollama": return Boolean(env.OLLAMA_BASE_URL?.trim());
    case "groq": return Boolean(env.GROQ_API_KEY?.trim());
    case "mistral": return Boolean(env.MISTRAL_API_KEY?.trim());
    case "gemini": return Boolean(env.GEMINI_API_KEY?.trim());
    case "anthropic": return Boolean(env.ANTHROPIC_API_KEY?.trim());
    case "openrouter": return Boolean(env.OPENROUTER_API_KEY?.trim());
  }
}

function supportedProvider(value: unknown, index: number): SupportedProvider { const provider = typeof value === "string" ? value.trim().toLowerCase() : ""; const supported: readonly SupportedProvider[] = ["omniroute", "9router", "kings", "openai", "ollama", "groq", "mistral", "gemini", "anthropic", "openrouter"]; if (supported.includes(provider as SupportedProvider)) return provider as SupportedProvider; throw new Error(`AI model resource ${index + 1} has unsupported provider "${provider}".`); }
function billingClassFromEnv(value: string | undefined, fallback: AiBillingClass, prefix: string): AiBillingClass { return parseBillingClass(value, fallback, `${prefix}_BILLING_CLASS`); }
function parseBillingClass(value: unknown, fallback: AiBillingClass, label: string): AiBillingClass { if (value === undefined || value === null || value === "") return fallback; const normalized = String(value).trim().toLowerCase() as AiBillingClass; if (!BILLING_CLASSES.includes(normalized)) throw new Error(`${label} must be one of ${BILLING_CLASSES.join(", ")}.`); return normalized; }
function optionalNumberField(value: Record<string, unknown>, key: keyof AiModelResource): Partial<AiModelResource> { const raw = value[key as string]; if (raw === undefined) return {}; if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) throw new Error(`AI model resource ${String(key)} must be a non-negative finite number.`); return { [key]: raw } as Partial<AiModelResource>; }
function optionalTimestamp(value: unknown, label: string): string | undefined { if (value === undefined) return undefined; if (typeof value !== "string" || !validTimestamp(value)) throw new Error(`${label} must be a valid timestamp.`); return value.trim(); }
function requiredString(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function positive(value: string | undefined): number | undefined { if (!value?.trim()) return undefined; const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined; }
function nonnegative(value: string | undefined): number | undefined { if (!value?.trim()) return undefined; const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined; }
function validTimestamp(value: string | undefined): boolean { return Boolean(value?.trim() && Number.isFinite(Date.parse(value))); }
