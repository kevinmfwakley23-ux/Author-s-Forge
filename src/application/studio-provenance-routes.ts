import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import type { FileCreativeProvenanceStore } from "../infrastructure/file-creative-provenance-store";
import {
  c2paMappingHint,
  sha256Text,
  type CreativeProvenanceEventInput,
  type HumanOversight,
  type ProvenanceAction,
  type ProvenanceActor,
  type ProvenanceAssetRef,
  type ProvenanceRegion,
  type ProvenanceRecipe,
  type ProvenanceSourceType,
} from "../domain/creative-provenance";
import { getBook, getScene, validateStudioWorkspace } from "../domain/studio-workspace";

export type StudioProvenanceRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioProvenanceRoutes(
  projects: Pick<FileProjectStore, "load">,
  provenance: FileCreativeProvenanceStore,
): StudioProvenanceRouteHandler {
  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/provenance`;

    if (url.pathname === root && req.method === "GET") {
      await requireProject(projects, projectId);
      const [records, verification] = await Promise.all([provenance.list(projectId), provenance.verify(projectId)]);
      json(res, 200, { records, verification });
      return true;
    }

    if (url.pathname === `${root}/export` && req.method === "GET") {
      await requireProject(projects, projectId);
      const records = await provenance.list(projectId);
      const verification = await provenance.verify(projectId);
      json(res, 200, {
        format: "authors-forge-provenance-export",
        formatVersion: 1,
        projectId,
        generatedAt: new Date().toISOString(),
        integrity: verification,
        contentCredentials: {
          targetStandard: "C2PA Content Credentials",
          signed: false,
          c2paCompliant: false,
          note: "This is Forge provenance metadata with C2PA mapping hints. It is not a cryptographically signed C2PA manifest. Signed credentials require a conforming signer and certificate/trust workflow.",
        },
        records: records.map((record) => ({ record, c2paMappingHint: c2paMappingHint(record) })),
      });
      return true;
    }

    if (url.pathname === `${root}/events` && req.method === "POST") {
      const project = await requireProject(projects, projectId);
      const input = await body(req);
      const event = eventInput(projectId, input);
      if (event.asset.kind === "scene") verifySceneGrounding(project, event);
      const record = await provenance.append(event);
      json(res, 201, record);
      return true;
    }

    return false;
  };
}

function eventInput(projectId: string, input: Record<string, unknown>): CreativeProvenanceEventInput {
  return {
    id: String(input.id ?? `provenance-${randomUUID()}`),
    projectId,
    action: String(input.action ?? "") as ProvenanceAction,
    sourceType: String(input.sourceType ?? "") as ProvenanceSourceType,
    actor: input.actor as ProvenanceActor,
    asset: input.asset as ProvenanceAssetRef,
    humanOversight: String(input.humanOversight ?? "") as HumanOversight,
    ...(input.createdAt ? { createdAt: String(input.createdAt) } : {}),
    ...(input.beforeSha256 ? { beforeSha256: String(input.beforeSha256) } : {}),
    ...(input.afterSha256 ? { afterSha256: String(input.afterSha256) } : {}),
    ...(Array.isArray(input.regions) ? { regions: input.regions as ProvenanceRegion[] } : {}),
    ...(Array.isArray(input.ingredients) ? { ingredients: input.ingredients as ProvenanceAssetRef[] } : {}),
    ...(input.recipe && typeof input.recipe === "object" ? { recipe: input.recipe as ProvenanceRecipe } : {}),
    ...(input.details && typeof input.details === "object" && !Array.isArray(input.details) ? { details: input.details as Record<string, string | number | boolean | null> } : {}),
  };
}

function verifySceneGrounding(project: { studioWorkspace?: unknown }, event: CreativeProvenanceEventInput): void {
  const asset = event.asset;
  if (!asset.bookId || !asset.chapterId || !asset.sceneId) throw new Error("Scene provenance requires bookId, chapterId, and sceneId.");
  const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : validateStudioWorkspace({ formatVersion: 1, activeBookId: null, books: [] });
  const scene = getScene(getBook(workspace, asset.bookId), asset.chapterId, asset.sceneId);
  if (event.afterSha256 && sha256Text(scene.content) !== event.afterSha256.toLowerCase()) throw new Error("Scene provenance after-hash does not match the current durable manuscript scene.");
}

async function requireProject(projects: Pick<FileProjectStore, "load">, projectId: string) {
  const project = await projects.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" not found.`);
  return project;
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 2 * 1024 * 1024) throw new Error("Creative provenance request body exceeds 2 MiB.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Creative provenance request body must be a JSON object.");
  return parsed as Record<string, unknown>;
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
