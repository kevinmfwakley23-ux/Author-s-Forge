import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { withProjectStudioWorkspace } from "../domain/project";
import { createStudioWorkspace, validateStudioWorkspace, type BookKind } from "../domain/studio-workspace";
import { applyManuscriptImport, previewManuscriptImport, type ManuscriptImportPreview } from "./studio-manuscript-import";

export type StudioManuscriptImportRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

const BOOK_KINDS: readonly BookKind[] = ["childrens-book", "memoir", "psychological-thriller", "guided-journal", "comic-book", "training-manual", "novel", "other"];
const REQUEST_LIMIT = 7 * 1024 * 1024;

export function createStudioManuscriptImportRoutes(projects: FileProjectStore): StudioManuscriptImportRouteHandler {
  return async (req, res, url, projectId) => {
    const root = `/api/projects/${projectId}/manuscript-import`;
    if (url.pathname === `${root}/preview` && req.method === "POST") {
      const input = await body(req);
      const preview = previewManuscriptImport({
        fileName: requiredString(input.fileName, "fileName", 260),
        dataBase64: requiredString(input.dataBase64, "dataBase64", REQUEST_LIMIT),
        bookTitle: optionalString(input.title, "title", 240),
      });
      json(res, 200, publicPreview(preview));
      return true;
    }

    if (url.pathname === `${root}/apply` && req.method === "POST") {
      const input = await body(req);
      const project = await projects.load(projectId);
      if (!project) throw new Error(`Project "${projectId}" not found.`);
      const preview = previewManuscriptImport({
        fileName: requiredString(input.fileName, "fileName", 260),
        dataBase64: requiredString(input.dataBase64, "dataBase64", REQUEST_LIMIT),
        bookTitle: optionalString(input.title, "title", 240),
      });
      const workspace = project.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : createStudioWorkspace();
      const result = applyManuscriptImport({
        workspace,
        preview,
        bookId: optionalString(input.bookId, "bookId", 180),
        title: optionalString(input.title, "title", 240),
        kind: optionalEnum(input.kind, BOOK_KINDS, "kind") ?? "novel",
        description: optionalString(input.description, "description", 8_000),
        now: optionalTimestamp(input.now, "now"),
      });
      await projects.save(withProjectStudioWorkspace(project, result.workspace));
      json(res, 201, {
        importedBookId: result.importedBookId,
        sourceSha256: preview.sourceSha256,
        fileName: preview.fileName,
        format: preview.format,
        chapterCount: preview.chapterCount,
        sceneCount: preview.sceneCount,
        wordCount: preview.wordCount,
        warnings: preview.warnings,
      });
      return true;
    }

    return false;
  };
}

function publicPreview(preview: ManuscriptImportPreview): Record<string, unknown> {
  return {
    formatVersion: preview.formatVersion,
    fileName: preview.fileName,
    format: preview.format,
    sourceBytes: preview.sourceBytes,
    sourceSha256: preview.sourceSha256,
    suggestedBookTitle: preview.suggestedBookTitle,
    chapterCount: preview.chapterCount,
    sceneCount: preview.sceneCount,
    wordCount: preview.wordCount,
    warnings: preview.warnings,
    chapters: preview.chapters.map((chapter) => ({
      number: chapter.number,
      title: chapter.title,
      wordCount: chapter.wordCount,
      scenes: chapter.scenes.map((scene) => ({ number: scene.number, title: scene.title, wordCount: scene.wordCount })),
    })),
  };
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > REQUEST_LIMIT) throw new Error("Manuscript import request exceeds the 7 MiB request limit.");
  }
  if (!raw.trim()) throw new Error("Manuscript import JSON body is required.");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Manuscript import JSON object body required.");
  return parsed as Record<string, unknown>;
}

function requiredString(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}

function optionalString(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, label, max);
}

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Invalid ${label}.`);
  return value as T;
}

function optionalTimestamp(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = requiredString(value, label, 100);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} must be a valid timestamp.`);
  return text;
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
