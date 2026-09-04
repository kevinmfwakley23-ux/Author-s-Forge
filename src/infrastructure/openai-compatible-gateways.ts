import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AiBillingClass, AiModelCapabilities, AiModelResource } from "../application/ai-model-broker";

export const OPENAI_COMPATIBLE_GATEWAY_FORMAT_VERSION = 1 as const;
const BILLING_CLASSES: readonly AiBillingClass[] = ["local", "subscription", "free", "metered", "gateway-managed", "unknown"];

export interface OpenAiCompatibleGatewayModel {
  readonly id: string;
  readonly billingClass?: AiBillingClass;
  readonly capabilities?: AiModelCapabilities;
  readonly estimatedInputCostPerMillion?: number;
  readonly estimatedOutputCostPerMillion?: number;
}
export interface OpenAiCompatibleGateway {
  readonly id: string;
  readonly label: string;
  readonly baseUrl: string;
  readonly apiKeyEnv?: string;
  readonly enabled: boolean;
  readonly models: readonly OpenAiCompatibleGatewayModel[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
interface GatewayFile {
  readonly formatVersion: typeof OPENAI_COMPATIBLE_GATEWAY_FORMAT_VERSION;
  readonly gateways: readonly OpenAiCompatibleGateway[];
}

export function loadOpenAiCompatibleGateways(env: NodeJS.ProcessEnv = process.env): OpenAiCompatibleGateway[] {
  try {
    const parsed = JSON.parse(readFileSync(gatewayPath(env), "utf8")) as GatewayFile;
    if (parsed.formatVersion !== OPENAI_COMPATIBLE_GATEWAY_FORMAT_VERSION || !Array.isArray(parsed.gateways)) throw new Error("Unsupported or corrupt OpenAI-compatible gateway registry.");
    const ids = new Set<string>();
    return parsed.gateways.map((gateway) => {
      const validated = validateOpenAiCompatibleGateway(gateway);
      if (ids.has(validated.id)) throw new Error(`Duplicate OpenAI-compatible gateway id "${validated.id}".`);
      ids.add(validated.id);
      return clone(validated);
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export function saveOpenAiCompatibleGateways(gateways: readonly OpenAiCompatibleGateway[], env: NodeJS.ProcessEnv = process.env): OpenAiCompatibleGateway[] {
  const ids = new Set<string>();
  const validated = gateways.map((gateway) => {
    const item = validateOpenAiCompatibleGateway(gateway);
    if (ids.has(item.id)) throw new Error(`Duplicate OpenAI-compatible gateway id "${item.id}".`);
    ids.add(item.id);
    return clone(item);
  });
  const path = gatewayPath(env);
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  const payload: GatewayFile = { formatVersion: OPENAI_COMPATIBLE_GATEWAY_FORMAT_VERSION, gateways: validated };
  writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temp, path);
  return validated.map(clone);
}

export function upsertOpenAiCompatibleGateway(input: unknown, env: NodeJS.ProcessEnv = process.env): OpenAiCompatibleGateway {
  const current = loadOpenAiCompatibleGateways(env);
  const existing = input && typeof input === "object" && !Array.isArray(input)
    ? current.find((item) => item.id === String((input as Record<string, unknown>).id ?? "").trim())
    : undefined;
  const now = new Date().toISOString();
  const next = validateOpenAiCompatibleGateway(normalizeGatewayInput(input, existing, now));
  saveOpenAiCompatibleGateways([...current.filter((item) => item.id !== next.id), next], env);
  return clone(next);
}

export function removeOpenAiCompatibleGateway(id: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const normalized = gatewayId(id);
  const current = loadOpenAiCompatibleGateways(env);
  const next = current.filter((item) => item.id !== normalized);
  if (next.length === current.length) return false;
  saveOpenAiCompatibleGateways(next, env);
  return true;
}

export function discoverOpenAiCompatibleGatewayResources(env: NodeJS.ProcessEnv = process.env): AiModelResource[] {
  return loadOpenAiCompatibleGateways(env).flatMap((gateway) => {
    if (!gateway.enabled) return [];
    const credentialReady = !gateway.apiKeyEnv || Boolean(env[gateway.apiKeyEnv]?.trim());
    if (!credentialReady) return [];
    return gateway.models.map((model): AiModelResource => ({
      provider: "gateway",
      model: gatewayModelKey(gateway.id, model.id),
      configured: true,
      healthy: true,
      billingClass: model.billingClass ?? "unknown",
      capabilities: model.capabilities ? { ...model.capabilities } : {},
      ...(model.estimatedInputCostPerMillion === undefined ? {} : { estimatedInputCostPerMillion: model.estimatedInputCostPerMillion }),
      ...(model.estimatedOutputCostPerMillion === undefined ? {} : { estimatedOutputCostPerMillion: model.estimatedOutputCostPerMillion }),
    }));
  });
}

export function resolveOpenAiCompatibleGatewayModel(encodedModel: string, env: NodeJS.ProcessEnv = process.env): { gateway: OpenAiCompatibleGateway; upstreamModel: string; apiKey?: string } {
  const separator = encodedModel.indexOf("::");
  if (separator <= 0 || separator === encodedModel.length - 2) throw new Error("Invalid OpenAI-compatible gateway model key.");
  const id = gatewayId(encodedModel.slice(0, separator));
  const upstreamModel = modelId(encodedModel.slice(separator + 2));
  const gateway = loadOpenAiCompatibleGateways(env).find((item) => item.id === id && item.enabled);
  if (!gateway) throw new Error(`OpenAI-compatible gateway "${id}" is not enabled or does not exist.`);
  if (!gateway.models.some((item) => item.id === upstreamModel)) throw new Error(`Model "${upstreamModel}" is not registered for gateway "${id}".`);
  const apiKey = gateway.apiKeyEnv ? env[gateway.apiKeyEnv]?.trim() : undefined;
  if (gateway.apiKeyEnv && !apiKey) throw new Error(`Gateway "${id}" requires environment secret ${gateway.apiKeyEnv}.`);
  return { gateway: clone(gateway), upstreamModel, ...(apiKey ? { apiKey } : {}) };
}

export function gatewayModelKey(gatewayIdValue: string, upstreamModel: string): string {
  return `${gatewayId(gatewayIdValue)}::${modelId(upstreamModel)}`;
}

export async function discoverGatewayModels(gateway: OpenAiCompatibleGateway, env: NodeJS.ProcessEnv = process.env): Promise<readonly string[]> {
  const validated = validateOpenAiCompatibleGateway(gateway);
  const apiKey = validated.apiKeyEnv ? env[validated.apiKeyEnv]?.trim() : undefined;
  if (validated.apiKeyEnv && !apiKey) throw new Error(`Gateway "${validated.id}" requires environment secret ${validated.apiKeyEnv}.`);
  const response = await fetch(`${validated.baseUrl.replace(/\/$/, "")}/v1/models`, {
    headers: { accept: "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`Gateway "${validated.id}" model discovery failed (${response.status}).`);
  const raw = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.models) ? payload.models : [];
  return [...new Set(raw.flatMap((value) => {
    if (typeof value === "string" && value.trim()) return [value.trim()];
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const record = value as Record<string, unknown>;
    const id = record.id ?? record.name ?? record.model;
    return typeof id === "string" && id.trim() ? [id.trim()] : [];
  }))].sort();
}

export function gatewayCredentialConfigured(gateway: OpenAiCompatibleGateway, env: NodeJS.ProcessEnv = process.env): boolean {
  return !gateway.apiKeyEnv || Boolean(env[gateway.apiKeyEnv]?.trim());
}

export function validateOpenAiCompatibleGateway(value: unknown): OpenAiCompatibleGateway {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("OpenAI-compatible gateway must be an object.");
  const input = value as Record<string, unknown>;
  const id = gatewayId(input.id);
  const label = text(input.label, "Gateway label", 120);
  const baseUrl = gatewayUrl(input.baseUrl);
  const apiKeyEnv = optionalEnvName(input.apiKeyEnv);
  if (typeof input.enabled !== "boolean") throw new Error("Gateway enabled must be boolean.");
  if (!Array.isArray(input.models)) throw new Error("Gateway models must be an array.");
  if (input.models.length > 500) throw new Error("A gateway cannot register more than 500 models.");
  const byId = new Map<string, OpenAiCompatibleGatewayModel>();
  for (const raw of input.models) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Gateway model must be an object.");
    const record = raw as Record<string, unknown>;
    const model: OpenAiCompatibleGatewayModel = {
      id: modelId(record.id),
      ...(record.billingClass === undefined ? {} : { billingClass: billingClass(record.billingClass) }),
      ...(record.capabilities === undefined ? {} : { capabilities: capabilities(record.capabilities) }),
      ...optionalCost(record, "estimatedInputCostPerMillion"),
      ...optionalCost(record, "estimatedOutputCostPerMillion"),
    };
    byId.set(model.id, model);
  }
  const createdAt = timestamp(input.createdAt, "Gateway createdAt");
  const updatedAt = timestamp(input.updatedAt, "Gateway updatedAt");
  return { id, label, baseUrl, ...(apiKeyEnv ? { apiKeyEnv } : {}), enabled: input.enabled, models: [...byId.values()], createdAt, updatedAt };
}

function normalizeGatewayInput(value: unknown, existing: OpenAiCompatibleGateway | undefined, now: string): OpenAiCompatibleGateway {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("OpenAI-compatible gateway JSON object required.");
  const input = value as Record<string, unknown>;
  const models = input.models === undefined ? existing?.models ?? [] : input.models;
  return {
    id: String(input.id ?? existing?.id ?? ""),
    label: String(input.label ?? existing?.label ?? ""),
    baseUrl: String(input.baseUrl ?? existing?.baseUrl ?? ""),
    ...(input.apiKeyEnv === null || input.apiKeyEnv === "" ? {} : input.apiKeyEnv !== undefined ? { apiKeyEnv: String(input.apiKeyEnv) } : existing?.apiKeyEnv ? { apiKeyEnv: existing.apiKeyEnv } : {}),
    enabled: input.enabled === undefined ? existing?.enabled ?? true : input.enabled === true,
    models: models as readonly OpenAiCompatibleGatewayModel[],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
function gatewayPath(env: NodeJS.ProcessEnv): string {
  const dataRoot = env.FORGE_DATA_DIR?.trim() || join(process.cwd(), ".forge-data");
  return join(dataRoot, "ai-openai-compatible-gateways.json");
}
function gatewayId(value: unknown): string {
  const id = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,48}$/.test(id)) throw new Error("Gateway id must use 1-49 lowercase letters, numbers, underscores, or hyphens and start with a letter/number.");
  return id;
}
function modelId(value: unknown): string {
  const id = String(value ?? "").trim();
  if (!id || id.length > 300 || /[\r\n]/.test(id)) throw new Error("Gateway model id must be 1-300 characters without newlines.");
  return id;
}
function text(value: unknown, label: string, max: number): string {
  const result = String(value ?? "").trim();
  if (!result || result.length > max || /[\r\n]/.test(result)) throw new Error(`${label} must be 1-${max} characters without newlines.`);
  return result;
}
function gatewayUrl(value: unknown): string {
  const raw = String(value ?? "").trim().replace(/\/$/, "");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Gateway base URL must be a valid URL."); }
  if (url.username || url.password || url.search || url.hash) throw new Error("Gateway base URL cannot contain credentials, query parameters, or fragments.");
  if (url.protocol === "https:") return url.toString().replace(/\/$/, "");
  if (url.protocol !== "http:") throw new Error("Gateway base URL must use HTTPS, or HTTP for loopback development only.");
  const host = url.hostname.toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1" && host !== "[::1]") throw new Error("Plain HTTP gateways are allowed only on loopback. Use HTTPS for remote or LAN gateways.");
  return url.toString().replace(/\/$/, "");
}
function optionalEnvName(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const name = String(value).trim();
  if (!/^[A-Z_][A-Z0-9_]{0,127}$/.test(name)) throw new Error("Gateway API-key environment variable must use uppercase letters, numbers, and underscores.");
  return name;
}
function billingClass(value: unknown): AiBillingClass {
  const normalized = String(value ?? "").trim().toLowerCase() as AiBillingClass;
  if (!BILLING_CLASSES.includes(normalized)) throw new Error("Invalid gateway model billing class.");
  return normalized;
}
function capabilities(value: unknown): AiModelCapabilities {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Gateway model capabilities must be an object.");
  const allowed = new Set(["contextWindow", "maxOutputTokens", "reasoning", "vision", "streaming", "toolCalls", "creativeWriting", "instructionFollowing", "longContext"]);
  const result: Record<string, boolean | number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!allowed.has(key)) throw new Error(`Unsupported gateway model capability "${key}".`);
    if (key === "contextWindow" || key === "maxOutputTokens") {
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) throw new Error(`Gateway model capability ${key} must be a positive number.`);
      result[key] = raw;
    } else {
      if (typeof raw !== "boolean") throw new Error(`Gateway model capability ${key} must be boolean.`);
      result[key] = raw;
    }
  }
  return result as AiModelCapabilities;
}
function optionalCost(record: Record<string, unknown>, key: "estimatedInputCostPerMillion" | "estimatedOutputCostPerMillion"): Partial<OpenAiCompatibleGatewayModel> {
  const raw = record[key];
  if (raw === undefined || raw === null || raw === "") return {};
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) throw new Error(`Gateway model ${key} must be a non-negative number.`);
  return { [key]: raw };
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`);
  return new Date(value).toISOString();
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
