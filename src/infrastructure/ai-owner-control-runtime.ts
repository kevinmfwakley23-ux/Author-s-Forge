import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AiCostRoutingMode } from "../application/ai-cost-routing-policy";
import type { AiModelResource, AiSpendPolicy } from "../application/ai-model-broker";
import { refreshAiModelRuntimeOptions } from "./ai-model-options-runtime";

const PROVIDERS = ["omniroute", "9router", "kings", "ollama", "groq", "mistral", "gemini", "anthropic", "openrouter", "openai"] as const;
export type AiOwnerProvider = typeof PROVIDERS[number];

export interface RuntimeAiOwnerControl {
  readonly formatVersion: 1;
  readonly spendPolicy: AiSpendPolicy;
  readonly routingMode: AiCostRoutingMode;
  readonly providerOrder: readonly AiOwnerProvider[];
  readonly pinnedProvider?: AiOwnerProvider;
  readonly pinnedModel?: string;
  readonly maxEstimatedRequestCostUsd?: number;
  readonly updatedAt?: string;
}

const DEFAULT_ORDER: readonly AiOwnerProvider[] = PROVIDERS;

/**
 * Reload the durable owner-level AI control and apply it at the shared provider
 * boundary. Every Forge office that calls generateText therefore observes the
 * same spend policy and provider/model switch even when launched as a separate
 * process. A corrupt control file always fails closed to No Paid Tokens.
 */
export function refreshPersistedAiOwnerControl(env: NodeJS.ProcessEnv = process.env): RuntimeAiOwnerControl {
  const control = readControl(env);
  env.AI_SPEND_POLICY = control.spendPolicy;
  env.AI_ROUTING_MODE = control.routingMode;
  env.AI_PROVIDER_ORDER = orderedProviders(control).join(",");
  if (control.maxEstimatedRequestCostUsd === undefined) delete env.AI_MAX_REQUEST_COST_USD;
  else env.AI_MAX_REQUEST_COST_USD = String(control.maxEstimatedRequestCostUsd);

  if (control.pinnedProvider && control.pinnedModel) {
    env.AI_PINNED_PROVIDER = control.pinnedProvider;
    env.AI_PINNED_MODEL = control.pinnedModel;
  } else {
    delete env.AI_PINNED_PROVIDER;
    delete env.AI_PINNED_MODEL;
  }

  // Model Freedom augments the configured pool and no-spend trust choices.
  // It never replaces owner pinning or weakens the shared spend policy.
  refreshAiModelRuntimeOptions(env);
  return control;
}

/** A real pin is an exact source switch, not merely a scoring preference. */
export function constrainResourcesForOwnerPin(
  resources: readonly AiModelResource[],
  control: RuntimeAiOwnerControl,
): AiModelResource[] {
  if (!control.pinnedProvider || !control.pinnedModel) return resources.map(cloneResource);
  return resources
    .filter((resource) => resource.provider === control.pinnedProvider && resource.model === control.pinnedModel)
    .map(cloneResource);
}

export function defaultAiOwnerControl(): RuntimeAiOwnerControl {
  return {
    formatVersion: 1,
    spendPolicy: "no-paid-tokens",
    routingMode: "economy",
    providerOrder: [...DEFAULT_ORDER],
  };
}

function readControl(env: NodeJS.ProcessEnv): RuntimeAiOwnerControl {
  const dataRoot = env.FORGE_DATA_DIR?.trim() || join(process.cwd(), ".forge-data");
  const path = join(dataRoot, "ai-runtime-control.json");
  try {
    const raw = readFileSync(path, "utf8");
    return validate(JSON.parse(raw));
  } catch {
    return defaultAiOwnerControl();
  }
}

function validate(value: unknown): RuntimeAiOwnerControl {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI owner control must be an object.");
  const input = value as Record<string, unknown>;
  if (input.formatVersion !== 1) throw new Error("Unsupported AI owner control format.");
  const spendPolicy = spendPolicyValue(input.spendPolicy);
  const routingMode = routingModeValue(input.routingMode);
  const providerOrder = providerOrderValue(input.providerOrder);
  const pinnedProvider = optionalProvider(input.pinnedProvider);
  const pinnedModel = optionalModel(input.pinnedModel);
  if ((pinnedProvider === undefined) !== (pinnedModel === undefined)) throw new Error("Pinned provider and model must be paired.");

  let maxEstimatedRequestCostUsd: number | undefined;
  if (input.maxEstimatedRequestCostUsd !== undefined && input.maxEstimatedRequestCostUsd !== null && input.maxEstimatedRequestCostUsd !== "") {
    const amount = Number(input.maxEstimatedRequestCostUsd);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid AI request-cost cap.");
    maxEstimatedRequestCostUsd = amount;
  }
  if (spendPolicy === "budgeted" && maxEstimatedRequestCostUsd === undefined) throw new Error("Budgeted AI control requires a request-cost cap.");

  return {
    formatVersion: 1,
    spendPolicy,
    routingMode,
    providerOrder,
    ...(pinnedProvider && pinnedModel ? { pinnedProvider, pinnedModel } : {}),
    ...(maxEstimatedRequestCostUsd === undefined ? {} : { maxEstimatedRequestCostUsd }),
    ...(typeof input.updatedAt === "string" && Number.isFinite(Date.parse(input.updatedAt)) ? { updatedAt: input.updatedAt } : {}),
  };
}

function orderedProviders(control: RuntimeAiOwnerControl): AiOwnerProvider[] {
  if (!control.pinnedProvider) return [...control.providerOrder];
  return [control.pinnedProvider, ...control.providerOrder.filter((provider) => provider !== control.pinnedProvider)];
}
function spendPolicyValue(value: unknown): AiSpendPolicy {
  if (value === "no-paid-tokens" || value === "budgeted" || value === "unrestricted") return value;
  throw new Error("Invalid AI spend policy.");
}
function routingModeValue(value: unknown): AiCostRoutingMode {
  if (value === "economy" || value === "balanced" || value === "quality") return value;
  throw new Error("Invalid AI routing mode.");
}
function providerOrderValue(value: unknown): AiOwnerProvider[] {
  if (!Array.isArray(value)) throw new Error("AI provider order must be an array.");
  const providers = value.map(providerValue);
  const unique = [...new Set(providers)];
  if (!unique.length) throw new Error("AI provider order cannot be empty.");
  return unique;
}
function providerValue(value: unknown): AiOwnerProvider {
  const provider = String(value ?? "").trim().toLowerCase() as AiOwnerProvider;
  if (!PROVIDERS.includes(provider)) throw new Error("Invalid AI provider.");
  return provider;
}
function optionalProvider(value: unknown): AiOwnerProvider | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return providerValue(value);
}
function optionalModel(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const model = String(value).trim();
  if (!model || model.length > 200 || /[\r\n]/.test(model)) throw new Error("Invalid AI model id.");
  return model;
}
function cloneResource(resource: AiModelResource): AiModelResource {
  return { ...resource, capabilities: { ...resource.capabilities } };
}
