import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AiBillingClass } from "../application/ai-model-broker";

export const AI_MODEL_OPTIONS_FORMAT_VERSION = 1 as const;
export const AI_MODEL_OPTION_PROVIDERS = ["omniroute", "9router", "kings", "ollama", "groq", "mistral", "gemini", "anthropic", "openrouter", "openai"] as const;
export type AiModelOptionProvider = typeof AI_MODEL_OPTION_PROVIDERS[number];

const MODEL_PREFIX: Readonly<Record<AiModelOptionProvider, string>> = {
  omniroute: "OMNIROUTE", "9router": "ROUTER9", kings: "KINGS_AI", ollama: "OLLAMA", groq: "GROQ",
  mistral: "MISTRAL", gemini: "GEMINI", anthropic: "ANTHROPIC", openrouter: "OPENROUTER", openai: "OPENAI",
};
const BILLING_CLASSES: readonly AiBillingClass[] = ["local", "subscription", "free", "metered", "gateway-managed", "unknown"];

export interface AiAdditionalModelOption {
  readonly provider: AiModelOptionProvider;
  readonly model: string;
  readonly billingClass?: AiBillingClass;
}

export interface AiModelRuntimeOptions {
  readonly formatVersion: typeof AI_MODEL_OPTIONS_FORMAT_VERSION;
  readonly additionalModels: readonly AiAdditionalModelOption[];
  readonly trustedNoSpendModels: readonly string[];
  readonly ensembleEnabled: boolean;
  readonly ensembleMaxWorkers: number;
  readonly ensembleMinQualityScore: number;
  readonly ensembleMaxTotalEstimatedCostUsd?: number;
  readonly updatedAt: string;
}

interface AppliedOptionsState {
  readonly extrasByProvider: Readonly<Record<AiModelOptionProvider, readonly string[]>>;
  readonly trusted: readonly string[];
  readonly explicitResourceKeys: readonly string[];
}
const appliedState = new WeakMap<NodeJS.ProcessEnv, AppliedOptionsState>();

export function defaultAiModelRuntimeOptions(now = new Date().toISOString()): AiModelRuntimeOptions {
  return {
    formatVersion: AI_MODEL_OPTIONS_FORMAT_VERSION,
    additionalModels: [],
    trustedNoSpendModels: [],
    ensembleEnabled: true,
    ensembleMaxWorkers: 3,
    ensembleMinQualityScore: 80,
    updatedAt: now,
  };
}

export function validateAiModelRuntimeOptions(value: unknown, previous = defaultAiModelRuntimeOptions()): AiModelRuntimeOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI model options must be an object.");
  const input = value as Record<string, unknown>;
  if (input.formatVersion !== undefined && input.formatVersion !== AI_MODEL_OPTIONS_FORMAT_VERSION) throw new Error("Unsupported AI model options format.");
  const additionalModels = input.additionalModels === undefined ? previous.additionalModels : normalizeAdditionalModels(input.additionalModels);
  const trustedNoSpendModels = input.trustedNoSpendModels === undefined ? previous.trustedNoSpendModels : normalizeTrustedModels(input.trustedNoSpendModels);
  const ensembleEnabled = input.ensembleEnabled === undefined ? previous.ensembleEnabled : boolean(input.ensembleEnabled, "ensembleEnabled");
  const ensembleMaxWorkers = input.ensembleMaxWorkers === undefined ? previous.ensembleMaxWorkers : boundedInteger(input.ensembleMaxWorkers, "ensembleMaxWorkers", 1, 8);
  const ensembleMinQualityScore = input.ensembleMinQualityScore === undefined ? previous.ensembleMinQualityScore : boundedInteger(input.ensembleMinQualityScore, "ensembleMinQualityScore", 70, 100);
  const ensembleMaxTotalEstimatedCostUsd = input.ensembleMaxTotalEstimatedCostUsd === undefined
    ? previous.ensembleMaxTotalEstimatedCostUsd
    : optionalNonnegative(input.ensembleMaxTotalEstimatedCostUsd, "ensembleMaxTotalEstimatedCostUsd");
  return {
    formatVersion: AI_MODEL_OPTIONS_FORMAT_VERSION,
    additionalModels,
    trustedNoSpendModels,
    ensembleEnabled,
    ensembleMaxWorkers,
    ensembleMinQualityScore,
    ...(ensembleMaxTotalEstimatedCostUsd === undefined ? {} : { ensembleMaxTotalEstimatedCostUsd }),
    updatedAt: new Date().toISOString(),
  };
}

export function loadAiModelRuntimeOptions(env: NodeJS.ProcessEnv = process.env): AiModelRuntimeOptions {
  const path = optionsPath(env);
  try {
    return validateAiModelRuntimeOptions(JSON.parse(readFileSync(path, "utf8")), defaultAiModelRuntimeOptions());
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") return defaultAiModelRuntimeOptions();
    return defaultAiModelRuntimeOptions();
  }
}

export function persistAiModelRuntimeOptions(input: unknown, env: NodeJS.ProcessEnv = process.env): AiModelRuntimeOptions {
  const current = loadAiModelRuntimeOptions(env);
  const next = validateAiModelRuntimeOptions(input, current);
  const path = optionsPath(env);
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temp, path);
  applyAiModelRuntimeOptions(next, env);
  return next;
}

/**
 * Augments configured model choices without replacing the owner's existing
 * provider/model configuration. No-spend trust is explicit and user-owned;
 * Forge never guesses that a router model is free.
 */
export function refreshAiModelRuntimeOptions(env: NodeJS.ProcessEnv = process.env): AiModelRuntimeOptions {
  const options = loadAiModelRuntimeOptions(env);
  applyAiModelRuntimeOptions(options, env);
  return options;
}

export function applyAiModelRuntimeOptions(options: AiModelRuntimeOptions, env: NodeJS.ProcessEnv = process.env): void {
  const previous = appliedState.get(env) ?? emptyAppliedState();
  const nextExtras = Object.fromEntries(AI_MODEL_OPTION_PROVIDERS.map((provider) => [provider, options.additionalModels.filter((item) => item.provider === provider).map((item) => item.model)])) as Record<AiModelOptionProvider, string[]>;

  for (const provider of AI_MODEL_OPTION_PROVIDERS) {
    const key = `${MODEL_PREFIX[provider]}_MODELS`;
    const current = csv(env[key]);
    const withoutPriorExtras = current.filter((model) => !previous.extrasByProvider[provider].includes(model));
    const combined = unique([...withoutPriorExtras, ...nextExtras[provider]]);
    if (combined.length) env[key] = combined.join(",");
    else delete env[key];
  }

  const currentTrusted = csv(env.AI_TRUSTED_NO_SPEND_MODELS).map((item) => item.toLowerCase());
  const withoutPriorTrusted = currentTrusted.filter((item) => !previous.trusted.includes(item));
  const trusted = unique([...withoutPriorTrusted, ...options.trustedNoSpendModels]);
  if (trusted.length) env.AI_TRUSTED_NO_SPEND_MODELS = trusted.join(",");
  else delete env.AI_TRUSTED_NO_SPEND_MODELS;

  const trustedSet = new Set(trusted);
  const currentExplicit = parseExplicitResources(env.AI_MODEL_RESOURCES_JSON);
  const withoutPriorExplicit = currentExplicit.filter((item) => !previous.explicitResourceKeys.includes(explicitKey(item)));
  const explicitExtras = options.additionalModels
    .filter((item) => item.billingClass !== undefined)
    .map((item) => ({ provider: item.provider, model: item.model, billingClass: effectiveOwnerBillingClass(item, trustedSet) }));
  const explicit = mergeExplicitResources(withoutPriorExplicit, explicitExtras);
  if (explicit.length) env.AI_MODEL_RESOURCES_JSON = JSON.stringify(explicit);
  else delete env.AI_MODEL_RESOURCES_JSON;

  env.AI_ENSEMBLE_ENABLED = String(options.ensembleEnabled);
  env.AI_ENSEMBLE_MAX_WORKERS = String(options.ensembleMaxWorkers);
  env.AI_ENSEMBLE_MIN_QUALITY_SCORE = String(options.ensembleMinQualityScore);
  if (options.ensembleMaxTotalEstimatedCostUsd === undefined) delete env.AI_ENSEMBLE_MAX_TOTAL_ESTIMATED_COST_USD;
  else env.AI_ENSEMBLE_MAX_TOTAL_ESTIMATED_COST_USD = String(options.ensembleMaxTotalEstimatedCostUsd);
  appliedState.set(env, {
    extrasByProvider: Object.freeze(Object.fromEntries(AI_MODEL_OPTION_PROVIDERS.map((provider) => [provider, Object.freeze([...nextExtras[provider]])])) as Record<AiModelOptionProvider, readonly string[]>),
    trusted: Object.freeze([...options.trustedNoSpendModels]),
    explicitResourceKeys: Object.freeze(explicitExtras.map(explicitKey)),
  });
}

export function modelOptionKey(provider: AiModelOptionProvider, model: string): string {
  return `${provider}/${model}`.toLowerCase();
}

function effectiveOwnerBillingClass(item: AiAdditionalModelOption, trusted: ReadonlySet<string>): AiBillingClass {
  const declared = item.billingClass ?? "unknown";
  const noSpendClass = declared === "free" || declared === "subscription" || declared === "local";
  const providerKnownLocal = item.provider === "ollama" || item.provider === "kings";
  if (noSpendClass && !providerKnownLocal && !trusted.has(modelOptionKey(item.provider, item.model))) return "unknown";
  return declared;
}
function emptyAppliedState(): AppliedOptionsState {
  return {
    extrasByProvider: Object.freeze(Object.fromEntries(AI_MODEL_OPTION_PROVIDERS.map((provider) => [provider, Object.freeze([])])) as Record<AiModelOptionProvider, readonly string[]>),
    trusted: Object.freeze([]),
    explicitResourceKeys: Object.freeze([]),
  };
}
function optionsPath(env: NodeJS.ProcessEnv): string {
  const dataRoot = env.FORGE_DATA_DIR?.trim() || join(process.cwd(), ".forge-data");
  return join(dataRoot, "ai-model-options.json");
}
function normalizeAdditionalModels(value: unknown): readonly AiAdditionalModelOption[] {
  if (!Array.isArray(value)) throw new Error("additionalModels must be an array.");
  const byKey = new Map<string, AiAdditionalModelOption>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Each additional model must be an object.");
    const record = raw as Record<string, unknown>;
    const provider = providerValue(record.provider);
    const model = modelValue(record.model);
    const billingClass = billingValue(record.billingClass);
    byKey.set(modelOptionKey(provider, model), { provider, model, ...(billingClass ? { billingClass } : {}) });
  }
  if (byKey.size > 200) throw new Error("AI additional model list cannot exceed 200 entries.");
  return [...byKey.values()].sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model));
}
function normalizeTrustedModels(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw new Error("trustedNoSpendModels must be an array.");
  const result = value.map((item) => {
    if (typeof item !== "string" || !item.trim() || item.length > 300 || /[\r\n]/.test(item)) throw new Error("Trusted no-spend model ids must be non-empty provider/model strings.");
    const normalized = item.trim().toLowerCase();
    if (!normalized.includes("/")) throw new Error(`Trusted no-spend model "${item}" must use provider/model form.`);
    return normalized;
  });
  return unique(result).slice(0, 200);
}
function providerValue(value: unknown): AiModelOptionProvider {
  const provider = String(value ?? "").trim().toLowerCase() as AiModelOptionProvider;
  if (!AI_MODEL_OPTION_PROVIDERS.includes(provider)) throw new Error(`Unsupported AI model provider "${provider}".`);
  return provider;
}
function modelValue(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 250 || /[\r\n]/.test(value)) throw new Error("AI model id must be a non-empty string of at most 250 characters.");
  return value.trim();
}
function billingValue(value: unknown): AiBillingClass | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase() as AiBillingClass;
  if (!BILLING_CLASSES.includes(normalized)) throw new Error("Invalid AI billing class.");
  return normalized;
}
function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean.`);
  return value;
}
function boundedInteger(value: unknown, label: string, minimum: number, maximum: number): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  return number;
}
function optionalNonnegative(value: unknown, label: string): number | undefined {
  if (value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} must be a non-negative number or blank.`);
  return number;
}
function csv(value: string | undefined): string[] { return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? []; }
function unique(values: readonly string[]): string[] { return [...new Set(values)]; }
function parseExplicitResources(raw: string | undefined): Record<string, unknown>[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
  } catch { return []; }
}
function mergeExplicitResources(base: readonly Record<string, unknown>[], extras: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const item of [...base, ...extras]) {
    const provider = String(item.provider ?? "").trim().toLowerCase();
    const model = String(item.model ?? "").trim();
    if (!provider || !model) continue;
    byKey.set(`${provider}::${model}`, { ...item, provider, model });
  }
  return [...byKey.values()];
}
function explicitKey(item: Record<string, unknown>): string {
  return `${String(item.provider ?? "").trim().toLowerCase()}::${String(item.model ?? "").trim()}`;
}
