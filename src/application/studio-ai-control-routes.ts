import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AiCostRoutingMode } from "./ai-cost-routing-policy";
import type { AiSpendPolicy } from "./ai-model-broker";
import { aiConfiguredResources, aiRoutingTelemetry } from "../infrastructure/ai-provider";
import type { FileProjectStore } from "../infrastructure/file-project-store";

const PROVIDERS = ["omniroute", "9router", "kings", "ollama", "groq", "mistral", "gemini", "anthropic", "openrouter", "openai"] as const;
type Provider = typeof PROVIDERS[number];
const MODEL_PREFIX: Readonly<Record<Provider, string>> = {
  omniroute: "OMNIROUTE", "9router": "ROUTER9", kings: "KINGS_AI", ollama: "OLLAMA", groq: "GROQ",
  mistral: "MISTRAL", gemini: "GEMINI", anthropic: "ANTHROPIC", openrouter: "OPENROUTER", openai: "OPENAI",
};

export interface AiOwnerControl {
  readonly formatVersion: 1;
  readonly spendPolicy: AiSpendPolicy;
  readonly routingMode: AiCostRoutingMode;
  readonly providerOrder: readonly Provider[];
  readonly pinnedProvider?: Provider;
  readonly pinnedModel?: string;
  readonly maxEstimatedRequestCostUsd?: number;
  readonly updatedAt: string;
}

const dataRoot = process.env.FORGE_DATA_DIR?.trim() || join(process.cwd(), ".forge-data");
const controlPath = join(dataRoot, "ai-runtime-control.json");
const baselineModels = new Map<string, string | undefined>();
for (const prefix of Object.values(MODEL_PREFIX)) {
  baselineModels.set(`${prefix}_MODEL`, process.env[`${prefix}_MODEL`]);
  baselineModels.set(`${prefix}_MODELS`, process.env[`${prefix}_MODELS`]);
}

let current = loadControl();
applyControl(current);

export type StudioAiControlRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioAiControlRoutes(store: Pick<FileProjectStore, "load">): StudioAiControlRouteHandler {
  return async (req, res, url, projectId) => {
    if (url.pathname === `/api/projects/${projectId}/ai/control` && req.method === "GET") {
      await requireProject(store, projectId);
      json(res, 200, snapshot());
      return true;
    }
    if (url.pathname === `/api/projects/${projectId}/ai/control` && req.method === "POST") {
      await requireProject(store, projectId);
      const input = await body(req);
      const next = validateControl(input, current);
      persistControl(next);
      current = next;
      applyControl(current);
      json(res, 200, snapshot());
      return true;
    }
    if (url.pathname === `/api/projects/${projectId}/ai/catalog` && req.method === "GET") {
      await requireProject(store, projectId);
      const provider = providerValue(url.searchParams.get("provider"));
      json(res, 200, await providerCatalog(provider));
      return true;
    }
    return false;
  };
}

function snapshot() {
  return {
    control: current,
    resources: aiConfiguredResources(),
    telemetry: aiRoutingTelemetry(),
    policyExplanation: current.spendPolicy === "no-paid-tokens"
      ? "Metered, unknown, and gateway-managed resources are blocked unless their billing class is explicitly configured as local, subscription, or free."
      : current.spendPolicy === "budgeted"
        ? "Paid/unknown resources require known price metadata and must stay within the configured per-request cap."
        : "All configured resources may be used; normal cost-conscious routing still applies.",
  };
}

function defaultControl(): AiOwnerControl {
  return {
    formatVersion: 1,
    spendPolicy: "no-paid-tokens",
    routingMode: "economy",
    providerOrder: ["omniroute", "9router", "kings", "ollama", "groq", "mistral", "gemini", "anthropic", "openrouter", "openai"],
    updatedAt: new Date().toISOString(),
  };
}
function loadControl(): AiOwnerControl {
  try {
    const raw = readFileSync(controlPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return validateControl(parsed, defaultControl());
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") return defaultControl();
    // Corrupt control files must fail safe into no-spend mode, never paid mode.
    return defaultControl();
  }
}
function persistControl(control: AiOwnerControl): void {
  mkdirSync(dirname(controlPath), { recursive: true });
  const temp = `${controlPath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(control, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temp, controlPath);
}
function applyControl(control: AiOwnerControl): void {
  process.env.AI_SPEND_POLICY = control.spendPolicy;
  process.env.AI_ROUTING_MODE = control.routingMode;
  process.env.AI_PROVIDER_ORDER = orderedProviders(control).join(",");
  if (control.maxEstimatedRequestCostUsd === undefined) delete process.env.AI_MAX_REQUEST_COST_USD;
  else process.env.AI_MAX_REQUEST_COST_USD = String(control.maxEstimatedRequestCostUsd);

  for (const [key, value] of baselineModels) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (control.pinnedProvider && control.pinnedModel) {
    const prefix = MODEL_PREFIX[control.pinnedProvider];
    process.env[`${prefix}_MODEL`] = control.pinnedModel;
    process.env[`${prefix}_MODELS`] = control.pinnedModel;
  }
}
function orderedProviders(control: AiOwnerControl): Provider[] {
  const base = [...control.providerOrder];
  if (!control.pinnedProvider) return base;
  return [control.pinnedProvider, ...base.filter((provider) => provider !== control.pinnedProvider)];
}
function validateControl(input: Record<string, unknown>, previous: AiOwnerControl): AiOwnerControl {
  const spendPolicy = spendPolicyValue(input.spendPolicy ?? previous.spendPolicy);
  const routingMode = routingModeValue(input.routingMode ?? previous.routingMode);
  const providerOrder = input.providerOrder === undefined ? previous.providerOrder : providerOrderValue(input.providerOrder);
  const pinnedProvider = optionalProvider(input.pinnedProvider);
  const pinnedModel = optionalModel(input.pinnedModel);
  if ((pinnedProvider === undefined) !== (pinnedModel === undefined)) throw new Error("Pinned provider and pinned model must be set or cleared together.");
  const rawCap = input.maxEstimatedRequestCostUsd;
  let maxEstimatedRequestCostUsd: number | undefined;
  if (rawCap !== undefined && rawCap !== null && rawCap !== "") {
    const value = Number(rawCap);
    if (!Number.isFinite(value) || value < 0) throw new Error("Maximum estimated request cost must be a non-negative number.");
    maxEstimatedRequestCostUsd = value;
  } else if (input.maxEstimatedRequestCostUsd === undefined) maxEstimatedRequestCostUsd = previous.maxEstimatedRequestCostUsd;
  if (spendPolicy === "budgeted" && maxEstimatedRequestCostUsd === undefined) throw new Error("Budgeted AI spend policy requires a per-request dollar cap.");
  return {
    formatVersion: 1,
    spendPolicy,
    routingMode,
    providerOrder,
    ...(pinnedProvider ? { pinnedProvider, pinnedModel } : {}),
    ...(maxEstimatedRequestCostUsd === undefined ? {} : { maxEstimatedRequestCostUsd }),
    updatedAt: new Date().toISOString(),
  };
}

async function providerCatalog(provider: Provider): Promise<{ provider: Provider; models: readonly Record<string, unknown>[]; source: string; fetchedAt: string }> {
  const fetchedAt = new Date().toISOString();
  switch (provider) {
    case "omniroute": return openAiCatalog(provider, process.env.OMNIROUTE_BASE_URL, process.env.OMNIROUTE_API_KEY, fetchedAt);
    case "9router": return openAiCatalog(provider, process.env.ROUTER9_BASE_URL, process.env.ROUTER9_API_KEY, fetchedAt);
    case "groq": return openAiCatalog(provider, process.env.GROQ_BASE_URL || "https://api.groq.com/openai", process.env.GROQ_API_KEY, fetchedAt);
    case "mistral": return openAiCatalog(provider, process.env.MISTRAL_BASE_URL || "https://api.mistral.ai", process.env.MISTRAL_API_KEY, fetchedAt);
    case "openrouter": return openAiCatalog(provider, process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api", process.env.OPENROUTER_API_KEY, fetchedAt);
    case "openai": return openAiCatalog(provider, "https://api.openai.com", process.env.OPENAI_API_KEY, fetchedAt);
    case "ollama": return ollamaCatalog(fetchedAt);
    case "gemini": return geminiCatalog(fetchedAt);
    case "anthropic": return anthropicCatalog(fetchedAt);
    case "kings": {
      const models = aiConfiguredResources().filter((resource) => resource.provider === "kings").map((resource) => ({ id: resource.model, billingClass: resource.billingClass, capabilities: resource.capabilities }));
      return { provider, models, source: "configured K.I.N.G.S. resources", fetchedAt };
    }
  }
}
async function openAiCatalog(provider: Provider, baseUrl: string | undefined, apiKey: string | undefined, fetchedAt: string) {
  if (!baseUrl?.trim()) throw new Error(`${provider} base URL is not configured.`);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/models`, { headers: { accept: "application/json", ...(apiKey?.trim() ? { authorization: `Bearer ${apiKey.trim()}` } : {}) }, signal: AbortSignal.timeout(10_000) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`${provider} model catalog failed (${response.status}).`);
  const raw = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : [];
  const models = raw.map(normalizeModelRecord).filter((model) => typeof model.id === "string" && model.id);
  // OmniRoute explicitly documents "auto" as a router-managed model. 9Router
  // requires a concrete model or combo returned by its catalog, so do not
  // fabricate a generic auto entry for 9Router.
  if (provider === "omniroute" && !models.some((model) => model.id === "auto")) models.unshift({ id: "auto", name: "Automatic router selection", routerManaged: true });
  return { provider, models, source: `${baseUrl.replace(/\/$/, "")}/v1/models`, fetchedAt };
}
async function ollamaCatalog(fetchedAt: string) {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim();
  if (!baseUrl) throw new Error("Ollama is not configured.");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(5_000) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Ollama model catalog failed (${response.status}).`);
  const raw = Array.isArray(payload.models) ? payload.models : [];
  return { provider: "ollama" as const, models: raw.map(normalizeModelRecord), source: `${baseUrl.replace(/\/$/, "")}/api/tags`, fetchedAt };
}
async function geminiCatalog(fetchedAt: string) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("Gemini is not configured.");
  const base = process.env.GEMINI_BASE_URL?.trim()?.replace(/\/$/, "") || "https://generativelanguage.googleapis.com/v1beta";
  const response = await fetch(`${base}/models?key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(10_000) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Gemini model catalog failed (${response.status}).`);
  const raw = Array.isArray(payload.models) ? payload.models : [];
  const models = raw.map((item) => {
    const record = normalizeModelRecord(item);
    const rawName = String(record.id ?? "");
    return { ...record, id: rawName.replace(/^models\//, "") };
  });
  return { provider: "gemini" as const, models, source: `${base}/models`, fetchedAt };
}
async function anthropicCatalog(fetchedAt: string) {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("Anthropic is not configured.");
  const base = process.env.ANTHROPIC_BASE_URL?.trim()?.replace(/\/$/, "") || "https://api.anthropic.com";
  const response = await fetch(`${base}/v1/models`, { headers: { "x-api-key": key, "anthropic-version": process.env.ANTHROPIC_VERSION?.trim() || "2023-06-01" }, signal: AbortSignal.timeout(10_000) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Anthropic model catalog failed (${response.status}).`);
  const raw = Array.isArray(payload.data) ? payload.data : [];
  return { provider: "anthropic" as const, models: raw.map(normalizeModelRecord), source: `${base}/v1/models`, fetchedAt };
}
function normalizeModelRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") return { id: value };
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const id = record.id ?? record.name ?? record.model;
  const normalized: Record<string, unknown> = { id: typeof id === "string" ? id : "" };
  for (const key of ["name", "displayName", "context_length", "contextWindow", "owned_by", "pricing", "architecture", "supported_parameters", "inputTokenLimit", "outputTokenLimit"]) if (record[key] !== undefined) normalized[key] = record[key];
  return normalized;
}

function spendPolicyValue(value: unknown): AiSpendPolicy {
  if (value === "no-paid-tokens" || value === "budgeted" || value === "unrestricted") return value;
  throw new Error("Invalid AI spend policy.");
}
function routingModeValue(value: unknown): AiCostRoutingMode {
  if (value === "economy" || value === "balanced" || value === "quality") return value;
  throw new Error("Invalid AI routing mode.");
}
function providerValue(value: unknown): Provider {
  const provider = String(value ?? "").trim().toLowerCase() as Provider;
  if (!PROVIDERS.includes(provider)) throw new Error("Invalid AI provider.");
  return provider;
}
function optionalProvider(value: unknown): Provider | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return providerValue(value);
}
function optionalModel(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const model = String(value).trim();
  if (!model || model.length > 200 || /[\r\n]/.test(model)) throw new Error("Invalid AI model id.");
  return model;
}
function providerOrderValue(value: unknown): Provider[] {
  if (!Array.isArray(value)) throw new Error("AI provider order must be an array.");
  const providers = value.map(providerValue);
  const unique = [...new Set(providers)];
  if (!unique.length) throw new Error("AI provider order cannot be empty.");
  return unique;
}
async function requireProject(store: Pick<FileProjectStore, "load">, projectId: string) {
  const project = await store.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" not found.`);
  return project;
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 256 * 1024) throw new Error("AI control request body exceeds 256 KiB limit.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI control JSON object body required.");
  return value as Record<string, unknown>;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
