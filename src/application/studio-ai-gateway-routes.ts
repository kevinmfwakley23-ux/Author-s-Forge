import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import {
  discoverGatewayModels,
  gatewayCredentialConfigured,
  loadOpenAiCompatibleGateways,
  removeOpenAiCompatibleGateway,
  saveOpenAiCompatibleGateways,
  upsertOpenAiCompatibleGateway,
  type OpenAiCompatibleGatewayModel,
} from "../infrastructure/openai-compatible-gateways";

export type StudioAiGatewayRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioAiGatewayRoutes(store: Pick<FileProjectStore, "load">): StudioAiGatewayRouteHandler {
  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/ai/gateways`;
    if (url.pathname === root && req.method === "GET") {
      await requireProject(store, projectId);
      json(res, 200, { gateways: safeSnapshot() });
      return true;
    }
    if (url.pathname === root && req.method === "POST") {
      await requireProject(store, projectId);
      const input = await body(req);
      rejectRawSecrets(input);
      const gateway = upsertOpenAiCompatibleGateway(input);
      json(res, 200, { gateway: safeGateway(gateway) });
      return true;
    }

    const match = url.pathname.match(new RegExp(`^${escapeRegex(root)}/([a-z0-9][a-z0-9_-]{0,48})(?:/(discover))?$`));
    if (!match) return false;
    await requireProject(store, projectId);
    const gatewayId = match[1];
    const action = match[2];

    if (!action && req.method === "DELETE") {
      if (!removeOpenAiCompatibleGateway(gatewayId)) throw new Error(`OpenAI-compatible gateway "${gatewayId}" not found.`);
      json(res, 200, { removed: true, gatewayId });
      return true;
    }

    if (action === "discover" && req.method === "POST") {
      const gateways = loadOpenAiCompatibleGateways();
      const gateway = gateways.find((item) => item.id === gatewayId);
      if (!gateway) throw new Error(`OpenAI-compatible gateway "${gatewayId}" not found.`);
      const input = await body(req);
      rejectRawSecrets(input);
      const discovered = await discoverGatewayModels(gateway);
      const persist = input.persist === true;
      let saved = gateway;
      if (persist) {
        const existing = new Map(gateway.models.map((model) => [model.id, model]));
        for (const id of discovered) if (!existing.has(id)) existing.set(id, { id } satisfies OpenAiCompatibleGatewayModel);
        saved = { ...gateway, models: [...existing.values()], updatedAt: new Date().toISOString() };
        saveOpenAiCompatibleGateways([...gateways.filter((item) => item.id !== gateway.id), saved]);
      }
      json(res, 200, {
        gateway: safeGateway(saved),
        discoveredModels: discovered,
        persisted: persist,
        note: persist
          ? "Discovered models were registered with unknown billing/capabilities unless already configured. Spend policy remains authoritative."
          : "Discovery is read-only until persist=true is explicitly requested.",
      });
      return true;
    }
    return false;
  };
}

function safeSnapshot() {
  return loadOpenAiCompatibleGateways().map(safeGateway);
}
function safeGateway(gateway: ReturnType<typeof loadOpenAiCompatibleGateways>[number]) {
  return {
    ...gateway,
    credentialConfigured: gatewayCredentialConfigured(gateway),
    apiKeyEnv: gateway.apiKeyEnv ?? null,
    secretValueReturned: false,
  };
}
function rejectRawSecrets(input: Record<string, unknown>): void {
  for (const key of ["apiKey", "token", "secret", "authorization", "password"]) {
    if (input[key] !== undefined) throw new Error(`Do not send raw ${key} values to the gateway registry. Reference an environment variable with apiKeyEnv instead.`);
  }
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
    if (raw.length > 1024 * 1024) throw new Error("Gateway request exceeds 1 MiB.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Gateway JSON object required.");
  return parsed as Record<string, unknown>;
}
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
