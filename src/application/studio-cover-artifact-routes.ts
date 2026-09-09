import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createBookCoverPlan, type CoverFormat, type InteriorType, type PaperType } from "../domain/book-cover-studio";
import { createMemoryRecord } from "../domain/memory";
import { withProjectBookCoverPlans, withProjectMemories } from "../domain/project";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { FileCoverArtifactVault } from "../infrastructure/file-cover-artifact-vault";
import { StudioCoverArtifactService } from "./studio-cover-artifact";

export type StudioCoverArtifactRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;
const RELEASE_COVER_FORMATS = ["ebook", "paperback", "hardcover"] as const;
const INTERIOR_TYPES = ["black-white", "premium-color", "standard-color"] as const;
const PAPER_TYPES = ["white", "cream", "groundwood"] as const;

export function createStudioCoverArtifactRoutes(store: FileProjectStore, vault: FileCoverArtifactVault): StudioCoverArtifactRouteHandler {
  const service = new StudioCoverArtifactService(store, vault);

  return async (req, res, url, projectId) => {
    const artifactRoot = `/api/projects/${projectId}/cover/artifacts`;
    const planRoot = `/api/projects/${projectId}/cover/plan`;

    // Canonical Cover Studio plan boundary. This runs before the historical server route,
    // preserves legacy paperback/hardcover requests, and adds the missing eBook plan lane.
    if (url.pathname === planRoot && req.method === "POST") {
      const input = await body(req);
      const project = await requireProject(store, projectId);
      const workspace = project.studioWorkspace;
      if (!workspace) throw new Error("Create a book before creating a cover plan.");
      const bookId = requiredText(input.bookId ?? workspace.activeBookId, "Book id");
      const book = workspace.books.find((candidate) => candidate.id === bookId);
      if (!book) throw new Error(`Book "${bookId}" was not found.`);
      const requested = input.format ?? input.binding ?? "paperback";
      const format = enumValue(requested, RELEASE_COVER_FORMATS, "cover format") as CoverFormat;
      const binding = format === "hardcover" ? "hardcover" as const : "paperback" as const;
      const minimumPages = format === "hardcover" ? 75 : 24;
      const pageCount = Math.max(minimumPages, positiveInteger(Number(input.pages ?? 200), "Page count"));
      const now = timestamp(input.now ?? new Date().toISOString());
      const title = optionalText(input.title) ?? book.title;
      const author = optionalText(input.author) ?? "Author";
      const plan = createBookCoverPlan({
        id: optionalId(input.id) ?? `cover-${randomUUID()}`,
        projectId,
        bookId,
        format,
        publishing: {
          platform: "kdp",
          binding,
          interiorType: enumValue(input.interior ?? "black-white", INTERIOR_TYPES, "interior type") as InteriorType,
          paperType: enumValue(input.paper ?? "white", PAPER_TYPES, "paper type") as PaperType,
          trimWidthInches: positiveNumber(Number(input.widthInches ?? 6), "Trim width"),
          trimHeightInches: positiveNumber(Number(input.heightInches ?? 9), "Trim height"),
          pageCount,
          bleedInches: 0.125,
          readingDirection: "ltr",
        },
        title,
        author,
        frontPrompt: optionalText(input.front) ?? "Create original front-cover artwork grounded in the approved book direction.",
        spineText: format === "ebook" ? "" : (optionalText(input.spineText) ?? `${title} — ${author}`),
        backText: optionalText(input.back) ?? (format === "ebook" ? "eBook cover" : "Back cover copy."),
        outputFormat: format === "ebook" ? "jpeg" : "pdf",
        dpi: 300,
        version: 1,
        approvalStatus: "draft",
        now,
      });
      const memory = createMemoryRecord({
        id: `memory-${randomUUID()}`,
        projectId,
        class: "production-memory",
        authority: "working",
        summary: `${format} cover plan: ${plan.title}`,
        content: JSON.stringify(plan, null, 2),
        provenance: [{ kind: "author", reference: "cover-studio", recordedAt: now }],
        relatedMemoryIds: [],
        relevanceTags: ["cover", "kdp", format],
        now,
      });
      let next = withProjectBookCoverPlans(project, [...(project.bookCoverPlans ?? []), plan], now);
      next = withProjectMemories(next, [...next.memories, memory], now);
      await store.save(next);
      json(res, 201, plan);
      return true;
    }

    if (url.pathname === artifactRoot && req.method === "GET") {
      const bookId = optionalText(url.searchParams.get("bookId"));
      const planId = optionalText(url.searchParams.get("planId"));
      const records = await vault.list(projectId, {
        ...(bookId ? { bookId } : {}),
        ...(planId ? { planId } : {}),
      });
      const artifacts = [];
      for (const evidence of records) artifacts.push(await vault.verify(evidence));
      json(res, 200, { projectId, bookId, planId, artifacts });
      return true;
    }

    if (url.pathname === artifactRoot && req.method === "POST") {
      const input = await body(req);
      const result = await service.render({
        projectId,
        bookId: requiredText(input.bookId, "Book id"),
        planId: requiredText(input.planId, "Cover plan id"),
        assetId: requiredText(input.assetId, "Cover artwork asset id"),
        authorApproved: input.authorApproved === true,
      });
      json(res, 201, {
        evidence: result.evidence,
        downloadPath: result.downloadPath,
        contentBase64: result.contentBase64,
      });
      return true;
    }

    const fileMatch = url.pathname.match(new RegExp(`^${escapeRegex(artifactRoot)}/([^/]+)/file$`));
    if (fileMatch && req.method === "GET") {
      const artifactId = decodeURIComponent(fileMatch[1]);
      const records = await vault.list(projectId);
      const evidence = records.find((candidate) => candidate.artifactId === artifactId);
      if (!evidence) throw new Error(`Cover artifact "${artifactId}" was not found.`);
      const bytes = await vault.read(evidence);
      res.writeHead(200, {
        "content-type": evidence.mimeType,
        "content-length": String(bytes.length),
        "content-disposition": `attachment; filename="${safeDownloadName(evidence.fileName)}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      res.end(bytes);
      return true;
    }

    return false;
  };
}

async function requireProject(store: FileProjectStore, projectId: string) {
  const project = await store.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" was not found.`);
  return project;
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 1024 * 1024) throw new Error("Cover request exceeds the 1 MiB limit.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON object body required.");
  return parsed as Record<string, unknown>;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(value));
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Invalid ${label}.`);
  return value as T;
}
function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function optionalId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = requiredText(value, "Identifier");
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error("Identifier contains unsupported characters.");
  return text;
}
function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer.`);
  return value;
}
function positiveNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number.`);
  return value;
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error("Timestamp must be valid.");
  return new Date(value).toISOString();
}
function safeDownloadName(value: string): string {
  const name = value.replace(/[\r\n\"\\/]/g, "-").trim();
  return name || "cover-artifact";
}
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
