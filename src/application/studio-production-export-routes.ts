import type { IncomingMessage, ServerResponse } from "node:http";
import { ManuscriptProductionService } from "./manuscript-production";
import { productionIllustrationFromAsset } from "./publication-image";
import { StudioPublishingMetadataService } from "./studio-publishing-metadata";
import { latestRightsDeclaration } from "../domain/asset-rights-provenance";
import { projectAssetRightsRegistry } from "../domain/project-rights";
import type { ProjectState } from "../domain/project";
import { getBook, validateStudioWorkspace } from "../domain/studio-workspace";
import { productionSourceSha256 } from "../domain/production-artifact-evidence";
import type { ProductionFormat, ProductionIllustration, ProductionManuscript, ProductionOptions } from "../domain/manuscript-production";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { FileProductionArtifactVault } from "../infrastructure/file-production-artifact-vault";

const PRODUCTION_FORMATS: readonly ProductionFormat[] = ["docx", "pdf", "epub", "kdp-docx", "kdp-pdf", "kdp-epub"];
const PAGE_SIZES = ["letter", "a4", "6x9", "5x8"] as const;

export type StudioProductionExportRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioProductionExportRoutes(
  store: FileProjectStore,
  vault: FileProductionArtifactVault,
): StudioProductionExportRouteHandler {
  const production = new ManuscriptProductionService();
  const publishing = new StudioPublishingMetadataService(store);

  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}`;
    if (url.pathname === `${root}/production/artifacts` && req.method === "GET") {
      const bookId = optionalText(url.searchParams.get("bookId"));
      const format = optionalProductionFormat(url.searchParams.get("format"));
      const records = await vault.list(projectId, {
        ...(bookId ? { bookId } : {}),
        ...(format ? { formats: [format] } : {}),
      });
      const artifacts = [];
      for (const evidence of records) artifacts.push(await vault.verify(evidence));
      respond(res, 200, { projectId, bookId, format, artifacts });
      return true;
    }

    if (url.pathname !== `${root}/export` || req.method !== "POST") return false;
    const input = await body(req);
    const project = await store.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" was not found.`);
    if (!project.studioWorkspace) throw new Error("Project has no Studio workspace.");
    const workspace = validateStudioWorkspace(project.studioWorkspace);
    const bookId = requiredText(input.bookId ?? workspace.activeBookId, "Book id");
    const book = getBook(workspace, bookId);
    const format = productionFormat(input.format ?? "docx");
    const metadata = await publishing.get(projectId, book.id);
    const author = metadata?.metadata.author ?? requiredText(input.author, "Author");
    const options: ProductionOptions = {
      format,
      pageSize: pageSize(input.pageSize),
      pageNumbers: input.pageNumbers === undefined ? true : booleanValue(input.pageNumbers, "pageNumbers"),
      includeTitlePage: input.includeTitlePage === undefined ? true : booleanValue(input.includeTitlePage, "includeTitlePage"),
      includeToc: input.includeToc === undefined ? true : booleanValue(input.includeToc, "includeToc"),
      ...(optionalText(input.runningHeader) ? { runningHeader: optionalText(input.runningHeader) } : {}),
      ...(optionalText(input.runningFooter) ? { runningFooter: optionalText(input.runningFooter) } : {}),
    };
    const manuscript: ProductionManuscript = {
      projectId,
      bookId: book.id,
      title: book.title,
      author,
      chapters: book.chapters.map((chapter) => ({
        id: chapter.id,
        number: chapter.number,
        title: chapter.title,
        scenes: chapter.scenes.map((scene) => {
          const illustrations = publicationIllustrations(project, book.id, chapter.id, scene.id);
          return {
            id: scene.id,
            title: scene.title,
            body: scene.content,
            ...(illustrations.length ? { illustrations } : {}),
          };
        }),
      })),
      frontMatter: [],
      backMatter: [],
    };
    const sourceSha256 = productionSourceSha256(manuscript, options);
    const artifact = production.render(manuscript, options);
    const evidence = await vault.save(artifact, options, sourceSha256);
    respond(res, 200, { ...artifact, persisted: true, evidence });
    return true;
  };
}

function publicationIllustrations(project: ProjectState, bookId: string, chapterId: string, sceneId: string): readonly ProductionIllustration[] {
  const assets = (project.illustrationAssetLibrary?.assets ?? [])
    .filter((asset) => asset.bookId === bookId && asset.chapterId === chapterId && asset.sceneId === sceneId)
    .filter((asset) => asset.approvalStatus === "approved" && asset.generationSettings.purpose === "illustration")
    .sort((a, b) => a.date.localeCompare(b.date) || a.version - b.version || a.id.localeCompare(b.id));
  if (!assets.length) return Object.freeze([]);
  const registry = projectAssetRightsRegistry(project);
  return Object.freeze(assets.map((asset) => {
    const declaration = latestRightsDeclaration(registry, asset.id);
    if (!declaration || declaration.publicationClearance !== "author-declared-cleared") {
      throw new Error(`Publication export is blocked: illustration asset "${asset.id}" does not have author-declared publication clearance.`);
    }
    if (Date.parse(declaration.recordedAt) < Date.parse(asset.updatedAt)) {
      throw new Error(`Publication export is blocked: rights clearance for illustration asset "${asset.id}" predates its latest asset revision. Review the final artwork and declare publication clearance again.`);
    }
    return productionIllustrationFromAsset(asset);
  }));
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) raw += String(chunk);
  if (raw.length > 8 * 1024 * 1024) throw new Error("Request body exceeds 8 MiB limit.");
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON object body required.");
  return parsed as Record<string, unknown>;
}
function respond(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function productionFormat(value: unknown): ProductionFormat {
  const format = requiredText(value, "Production format") as ProductionFormat;
  if (!PRODUCTION_FORMATS.includes(format)) throw new Error("Invalid production format.");
  return format;
}
function optionalProductionFormat(value: unknown): ProductionFormat | undefined {
  return value === undefined || value === null || value === "" ? undefined : productionFormat(value);
}
function pageSize(value: unknown): "letter" | "a4" | "6x9" | "5x8" {
  if (value === undefined || value === null || value === "") return "letter";
  if (typeof value !== "string" || !PAGE_SIZES.includes(value as typeof PAGE_SIZES[number])) throw new Error("Invalid production page size.");
  return value as typeof PAGE_SIZES[number];
}
function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean.`);
  return value;
}
