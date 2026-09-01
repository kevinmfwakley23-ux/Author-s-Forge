import type { IncomingMessage, ServerResponse } from "node:http";
import { EducationalWorkbookDifferentiationService } from "./educational-workbook-differentiation";
import { EducationalWorkbookDifferentiationProductionService } from "./educational-workbook-differentiation-production";
import type { EducationalWorkbookOfficeService } from "./educational-workbook-office";
import { WORKBOOK_GRADE_BANDS, WORKBOOK_SUBJECTS, type WorkbookGradeBand, type WorkbookSubject } from "../domain/educational-workbook";
import { FileEducationalWorkbookDifferentiationStore } from "../infrastructure/file-educational-workbook-differentiation-store";

export type EducationalWorkbookDifferentiationRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createEducationalWorkbookDifferentiationRoutes(input: { readonly office: EducationalWorkbookOfficeService; readonly storePath: string }): EducationalWorkbookDifferentiationRouteHandler {
  const differentiation = new EducationalWorkbookDifferentiationService(input.office, new FileEducationalWorkbookDifferentiationStore(required(input.storePath, "Differentiation store path")));
  const production = new EducationalWorkbookDifferentiationProductionService();

  return async (req, res, url, projectId) => {
    const base = `/api/projects/${projectId}/workbooks/differentiation`;
    if (url.pathname === `${base}/readiness` && req.method === "GET") {
      const result = await differentiation.readiness({
        projectId,
        gradeBand: gradeBand(url.searchParams.get("gradeBand")),
        activityCountPerVariant: integer(url.searchParams.get("activityCountPerVariant"), 10),
        subjects: subjects(url.searchParams.get("subjects")),
        standards: strings(url.searchParams.get("standards")),
        tags: strings(url.searchParams.get("tags")),
      });
      json(res, 200, result);
      return true;
    }
    if (url.pathname === `${base}/packs` && req.method === "GET") {
      json(res, 200, { packs: await differentiation.list(projectId) });
      return true;
    }
    if (url.pathname === `${base}/packs` && req.method === "POST") {
      const payload = await body(req);
      const pack = await differentiation.createPack({
        id: required(payload.id, "Differentiation pack id"),
        projectId,
        title: required(payload.title, "Differentiation pack title"),
        gradeBand: gradeBand(payload.gradeBand),
        seed: required(payload.seed, "Differentiation seed"),
        activityCountPerVariant: integer(payload.activityCountPerVariant, 0),
        learningObjectives: strings(payload.learningObjectives),
        directions: strings(payload.directions),
        standards: strings(payload.standards),
        tags: strings(payload.tags),
        subjects: subjects(payload.subjects),
        includeAnswerKey: payload.includeAnswerKey !== false,
      });
      json(res, 201, pack);
      return true;
    }
    const guideMatch = url.pathname.match(new RegExp(`^${escapeRegExp(base)}/packs/([^/]+)/teacher-guide$`));
    if (guideMatch && req.method === "POST") {
      const pack = await differentiation.get(projectId, decodeURIComponent(guideMatch[1]));
      if (!pack) { json(res, 404, { error: "Educational differentiation pack not found." }); return true; }
      const payload = await body(req);
      json(res, 201, production.renderTeacherGuide({ pack, bookId: required(payload.bookId, "Teacher guide book id"), author: required(payload.author, "Teacher guide author") }));
      return true;
    }
    const packMatch = url.pathname.match(new RegExp(`^${escapeRegExp(base)}/packs/([^/]+)$`));
    if (packMatch && req.method === "GET") {
      const pack = await differentiation.get(projectId, decodeURIComponent(packMatch[1]));
      json(res, pack ? 200 : 404, pack ?? { error: "Educational differentiation pack not found." });
      return true;
    }
    return false;
  };
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) { raw += String(chunk); if (raw.length > 2 * 1024 * 1024) throw new Error("Differentiation request body exceeds 2 MiB limit."); }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON object body required.");
  return parsed as Record<string, unknown>;
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))] : typeof value === "string" ? [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))] : [];
}
function subjects(value: unknown): WorkbookSubject[] {
  return strings(value).map((item) => { if (!WORKBOOK_SUBJECTS.includes(item as WorkbookSubject)) throw new Error(`Unsupported workbook subject "${item}".`); return item as WorkbookSubject; });
}
function gradeBand(value: unknown): WorkbookGradeBand {
  if (typeof value !== "string" || !WORKBOOK_GRADE_BANDS.includes(value as WorkbookGradeBand)) throw new Error("Invalid workbook grade band.");
  return value as WorkbookGradeBand;
}
function integer(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}
function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
