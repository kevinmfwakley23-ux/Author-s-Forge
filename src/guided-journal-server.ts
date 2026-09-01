import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { FileProjectStore } from "./infrastructure/file-project-store";
import { FileGuidedJournalStore } from "./infrastructure/file-guided-journal-store";
import { FileGuidedJournalLibraryStore } from "./infrastructure/file-guided-journal-library-store";
import { GuidedJournalOfficeService } from "./application/guided-journal-office";
import { GuidedJournalLibraryService } from "./application/guided-journal-library";
import { GuidedJournalIntelligenceService, type JournalAiPromptProposal } from "./application/guided-journal-intelligence";
import { GuidedJournalProductionService } from "./application/guided-journal-production";
import { GuidedJournalWorkspaceService } from "./application/guided-journal-workspace";
import { ProjectMemoryStore } from "./application/project-memory-store";
import { BookCoverStudioService } from "./application/book-cover-studio";
import { createProject, withProjectBookCoverPlans, withProjectMemories, type ProjectState } from "./domain/project";
import { JOURNAL_CATEGORIES, JOURNAL_PAGE_STYLES, type JournalCategory, type JournalCoverStatement, type JournalPageStyle, type JournalPrompt } from "./domain/guided-journal";
import { createJournalInteriorFormat, defaultJournalInteriorFormat, JOURNAL_PROMPT_ALIGNMENTS, type JournalInteriorFormat, type JournalPromptAlignment } from "./domain/guided-journal-layout";

const port = Number(process.env.JOURNAL_PORT ?? process.env.PORT ?? 4273);
const host = process.env.HOST ?? "127.0.0.1";
const dataRoot = process.env.FORGE_DATA_DIR ?? join(process.cwd(), ".forge-data");
const publicRoot = join(process.cwd(), "public");
const projects = new FileProjectStore(dataRoot);
const editions = new GuidedJournalOfficeService(new FileGuidedJournalStore(join(dataRoot, "guided-journal-editions.json")));
const library = new GuidedJournalLibraryService(new FileGuidedJournalLibraryStore(join(dataRoot, "guided-journal-library.json")));
const production = new GuidedJournalProductionService();

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 12 * 1024 * 1024) throw new Error("Request body exceeds 12 MiB limit.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON object body required.");
  return parsed as Record<string, unknown>;
}

function projectIdFrom(pathname: string): string | null {
  return pathname.match(/^\/api\/projects\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] ?? null;
}

function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))] : [];
}

function bool(value: unknown, fallback: boolean): boolean { return value === undefined ? fallback : value === true; }
function number(value: unknown, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

function journalCategory(value: unknown, optional = false): JournalCategory | undefined {
  if (value === undefined || value === null || value === "") { if (optional) return undefined; throw new Error("Journal category is required."); }
  if (typeof value !== "string" || !JOURNAL_CATEGORIES.includes(value as JournalCategory)) throw new Error("Invalid journal category.");
  return value as JournalCategory;
}

function pageStyle(value: unknown, fallback: JournalPageStyle = "lined"): JournalPageStyle {
  const candidate = value === undefined ? fallback : value;
  if (typeof candidate !== "string" || !JOURNAL_PAGE_STYLES.includes(candidate as JournalPageStyle)) throw new Error("Invalid journal page style.");
  return candidate as JournalPageStyle;
}

function promptAlignment(value: unknown, fallback: JournalPromptAlignment = "center"): JournalPromptAlignment {
  const candidate = value === undefined ? fallback : value;
  if (typeof candidate !== "string" || !JOURNAL_PROMPT_ALIGNMENTS.includes(candidate as JournalPromptAlignment)) throw new Error("Invalid journal prompt alignment.");
  return candidate as JournalPromptAlignment;
}

function formatFrom(input: unknown, journalStyle: JournalPageStyle, responsePages: number): JournalInteriorFormat {
  if (!input || typeof input !== "object" || Array.isArray(input)) return defaultJournalInteriorFormat(journalStyle, responsePages);
  const raw = input as Record<string, unknown>;
  const defaults = defaultJournalInteriorFormat(journalStyle, responsePages);
  const margins = raw.margins && typeof raw.margins === "object" && !Array.isArray(raw.margins) ? raw.margins as Record<string, unknown> : {};
  return createJournalInteriorFormat({
    trimWidthInches: number(raw.trimWidthInches, defaults.trimWidthInches),
    trimHeightInches: number(raw.trimHeightInches, defaults.trimHeightInches),
    pageStyle: pageStyle(raw.pageStyle, journalStyle),
    responsePagesPerPrompt: Math.trunc(number(raw.responsePagesPerPrompt, responsePages)),
    promptFontFamily: typeof raw.promptFontFamily === "string" && raw.promptFontFamily.trim() ? raw.promptFontFamily.trim() : defaults.promptFontFamily,
    promptFontSizePt: number(raw.promptFontSizePt, defaults.promptFontSizePt),
    responseFontFamily: typeof raw.responseFontFamily === "string" && raw.responseFontFamily.trim() ? raw.responseFontFamily.trim() : defaults.responseFontFamily,
    responseFontSizePt: number(raw.responseFontSizePt, defaults.responseFontSizePt),
    promptAlignment: promptAlignment(raw.promptAlignment, defaults.promptAlignment),
    lineSpacingInches: number(raw.lineSpacingInches, defaults.lineSpacingInches),
    dotSpacingInches: number(raw.dotSpacingInches, defaults.dotSpacingInches),
    margins: {
      topInches: number(margins.topInches, defaults.margins.topInches),
      bottomInches: number(margins.bottomInches, defaults.margins.bottomInches),
      insideInches: number(margins.insideInches, defaults.margins.insideInches),
      outsideInches: number(margins.outsideInches, defaults.margins.outsideInches),
    },
    showPageNumbers: bool(raw.showPageNumbers, defaults.showPageNumbers),
    showCategoryLabel: bool(raw.showCategoryLabel, defaults.showCategoryLabel),
    promptStartsOnNewPage: bool(raw.promptStartsOnNewPage, defaults.promptStartsOnNewPage),
    includeTitlePage: bool(raw.includeTitlePage, defaults.includeTitlePage),
    includeCopyrightPage: bool(raw.includeCopyrightPage, defaults.includeCopyrightPage),
    includeIntroductionPages: Math.trunc(number(raw.includeIntroductionPages, defaults.includeIntroductionPages)),
    includeClosingPages: Math.trunc(number(raw.includeClosingPages, defaults.includeClosingPages)),
  });
}

async function runtime(project: ProjectState): Promise<{ workspace: GuidedJournalWorkspaceService; memory: ProjectMemoryStore; covers: BookCoverStudioService }> {
  const memory = new ProjectMemoryStore();
  memory.restore(project.memories);
  const covers = new BookCoverStudioService();
  const intelligence = new GuidedJournalIntelligenceService(memory, covers);
  return { workspace: new GuidedJournalWorkspaceService(editions, library, intelligence, production), memory, covers };
}

async function persistMemories(project: ProjectState, memory: ProjectMemoryStore, now = new Date().toISOString()): Promise<ProjectState> {
  const next = withProjectMemories(project, memory.toPortableState(), now);
  await projects.save(next);
  return next;
}

function aiStatus() {
  return {
    omniroute: Boolean(process.env.OMNIROUTE_BASE_URL?.trim()),
    router9: Boolean(process.env.ROUTER9_BASE_URL?.trim()),
    kings: Boolean(process.env.KINGS_AI_ENDPOINT?.trim()),
    openai: Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim()),
    ollama: Boolean(process.env.OLLAMA_BASE_URL?.trim() && process.env.OLLAMA_MODEL?.trim()),
  };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (url.pathname === "/api/health" && req.method === "GET") {
    json(res, 200, { ok: true, service: "authors-forge-guided-journal-office", sharedDataRoot: dataRoot, ai: aiStatus(), categories: JOURNAL_CATEGORIES, pageStyles: JOURNAL_PAGE_STYLES });
    return true;
  }
  if (url.pathname === "/api/projects" && req.method === "POST") {
    const input = await body(req);
    const project = createProject({ id: required(input.id, "Project id"), title: required(input.title, "Project title") });
    await projects.create(project);
    json(res, 201, project);
    return true;
  }
  const projectId = projectIdFrom(url.pathname);
  if (!projectId) return false;
  const project = await projects.load(projectId);
  if (!project) { json(res, 404, { error: "Project not found." }); return true; }
  const { workspace, memory, covers } = await runtime(project);

  if (url.pathname === `/api/projects/${projectId}` && req.method === "GET") {
    const [source, history] = await Promise.all([workspace.getLibrary(projectId), workspace.listEditions(projectId)]);
    json(res, 200, { project: project.metadata, memoryCount: project.memories.length, coverPlanCount: project.bookCoverPlans?.length ?? 0, promptCount: source.prompts.length, coverStatementCount: source.coverStatements.length, editionCount: history.length, ai: aiStatus() });
    return true;
  }
  if (url.pathname === `/api/projects/${projectId}/journal/library` && req.method === "GET") { json(res, 200, await workspace.getLibrary(projectId)); return true; }
  if (url.pathname === `/api/projects/${projectId}/journal/library/import` && req.method === "POST") {
    const input = await body(req);
    const prompts = Array.isArray(input.prompts) ? input.prompts as JournalPrompt[] : [];
    const coverStatements = Array.isArray(input.coverStatements) ? input.coverStatements as JournalCoverStatement[] : [];
    if (!prompts.length && !coverStatements.length) throw new Error("Import requires prompts or cover statements.");
    if (prompts.length) await library.upsertPrompts(projectId, prompts);
    if (coverStatements.length) await library.upsertCoverStatements(projectId, coverStatements);
    json(res, 200, await workspace.getLibrary(projectId)); return true;
  }
  if (url.pathname === `/api/projects/${projectId}/journal/library/prompts` && req.method === "POST") {
    const input = await body(req);
    const prompt: JournalPrompt = { id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : `prompt-${randomUUID()}`, category: journalCategory(input.category)!, text: required(input.text, "Prompt text"), tags: strings(input.tags), enabled: input.enabled !== false };
    json(res, 201, await library.upsertPrompts(projectId, [prompt])); return true;
  }
  const promptMatch = url.pathname.match(new RegExp(`^/api/projects/${projectId}/journal/library/prompts/([^/]+)$`));
  if (promptMatch && req.method === "PATCH") { const input = await body(req); json(res, 200, await library.setPromptEnabled(projectId, decodeURIComponent(promptMatch[1]), input.enabled === true)); return true; }
  if (promptMatch && req.method === "DELETE") { json(res, 200, await library.removePrompt(projectId, decodeURIComponent(promptMatch[1]))); return true; }

  if (url.pathname === `/api/projects/${projectId}/journal/library/cover-statements` && req.method === "POST") {
    const input = await body(req);
    const statement: JournalCoverStatement = { id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : `cover-statement-${randomUUID()}`, text: required(input.text, "Cover statement text"), tags: strings(input.tags), enabled: input.enabled !== false };
    json(res, 201, await library.upsertCoverStatements(projectId, [statement])); return true;
  }
  const statementMatch = url.pathname.match(new RegExp(`^/api/projects/${projectId}/journal/library/cover-statements/([^/]+)$`));
  if (statementMatch && req.method === "PATCH") { const input = await body(req); json(res, 200, await library.setCoverStatementEnabled(projectId, decodeURIComponent(statementMatch[1]), input.enabled === true)); return true; }
  if (statementMatch && req.method === "DELETE") { json(res, 200, await library.removeCoverStatement(projectId, decodeURIComponent(statementMatch[1]))); return true; }

  if (url.pathname === `/api/projects/${projectId}/journal/random` && req.method === "POST") {
    const input = await body(req);
    json(res, 200, await workspace.randomQuestion({ projectId, seed: required(input.seed, "Randomizer seed"), ...(journalCategory(input.category, true) ? { category: journalCategory(input.category, true)! } : {}), excludedPromptIds: strings(input.excludedPromptIds) }));
    return true;
  }
  if (url.pathname === `/api/projects/${projectId}/journal/editions` && req.method === "GET") { json(res, 200, await workspace.listEditions(projectId)); return true; }
  if (url.pathname === `/api/projects/${projectId}/journal/editions` && req.method === "POST") {
    const input = await body(req);
    const categories = strings(input.categories).map((value) => journalCategory(value)!) as JournalCategory[];
    const journal = await workspace.createEdition({
      id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : `journal-${randomUUID()}`,
      projectId,
      title: required(input.title, "Journal title"),
      ...(typeof input.subtitle === "string" && input.subtitle.trim() ? { subtitle: input.subtitle.trim() } : {}),
      seed: required(input.seed, "Journal seed"),
      promptCount: Math.trunc(number(input.promptCount, 0)),
      ...(categories.length ? { categories } : {}),
      promptIds: strings(input.promptIds), excludedPromptIds: strings(input.excludedPromptIds),
      pageStyle: pageStyle(input.pageStyle), responsePagesPerPrompt: Math.trunc(number(input.responsePagesPerPrompt, 1)),
      includeCoverStatement: input.includeCoverStatement !== false, noRepeatAcrossEditions: input.noRepeatAcrossEditions !== false,
    });
    await persistMemories(project, memory);
    json(res, 201, journal); return true;
  }
  const editionMatch = url.pathname.match(new RegExp(`^/api/projects/${projectId}/journal/editions/([^/]+)$`));
  if (editionMatch && req.method === "GET") { const journal = await workspace.getEdition(projectId, decodeURIComponent(editionMatch[1])); if (!journal) json(res, 404, { error: "Journal edition not found." }); else json(res, 200, journal); return true; }

  if (url.pathname === `/api/projects/${projectId}/journal/render` && req.method === "POST") {
    const input = await body(req);
    const journal = await workspace.getEdition(projectId, required(input.journalId, "Journal edition id"));
    if (!journal) throw new Error("Journal edition not found.");
    const format = formatFrom(input.format, journal.pageStyle, journal.responsePagesPerPrompt);
    const rendered = workspace.renderPdf({ journal, format, bookId: required(input.bookId, "Book id"), author: required(input.author, "Author"), ...(typeof input.copyrightHolder === "string" && input.copyrightHolder.trim() ? { copyrightHolder: input.copyrightHolder.trim() } : {}), introduction: strings(input.introduction), closing: strings(input.closing) });
    await persistMemories(project, memory);
    json(res, 201, rendered); return true;
  }

  if (url.pathname === `/api/projects/${projectId}/journal/ai/prompts` && req.method === "POST") {
    const input = await body(req);
    const proposal = await workspace.proposePrompts({ projectId, category: journalCategory(input.category)!, count: Math.trunc(number(input.count, 0)), purpose: typeof input.purpose === "string" ? input.purpose : undefined, audience: typeof input.audience === "string" ? input.audience : undefined });
    json(res, 200, proposal); return true;
  }
  if (url.pathname === `/api/projects/${projectId}/journal/ai/prompts/approve` && req.method === "POST") {
    const input = await body(req);
    if (!input.proposal || typeof input.proposal !== "object" || Array.isArray(input.proposal)) throw new Error("AI prompt proposal is required.");
    const proposal = input.proposal as unknown as JournalAiPromptProposal;
    if (!Array.isArray(proposal.prompts) || !proposal.ai || typeof proposal.ai !== "object") throw new Error("Invalid AI prompt proposal.");
    json(res, 200, await workspace.approvePromptProposal(projectId, proposal)); return true;
  }
  if (url.pathname === `/api/projects/${projectId}/journal/ai/cover` && req.method === "POST") {
    const input = await body(req);
    const journal = await workspace.getEdition(projectId, required(input.journalId, "Journal edition id"));
    if (!journal) throw new Error("Journal edition not found.");
    json(res, 200, await workspace.proposeCoverDirection({ projectId, journal, audience: typeof input.audience === "string" ? input.audience : undefined, tone: typeof input.tone === "string" ? input.tone : undefined }));
    return true;
  }
  if (url.pathname === `/api/projects/${projectId}/journal/cover` && req.method === "POST") {
    const input = await body(req);
    const journal = await workspace.getEdition(projectId, required(input.journalId, "Journal edition id"));
    if (!journal) throw new Error("Journal edition not found.");
    const format = formatFrom(input.format, journal.pageStyle, journal.responsePagesPerPrompt);
    const rendered = workspace.renderPdf({ journal, format, bookId: required(input.bookId, "Book id"), author: required(input.author, "Author") });
    const coverPlanId = typeof input.coverPlanId === "string" && input.coverPlanId.trim() ? input.coverPlanId.trim() : `journal-cover-${randomUUID()}`;
    if ((project.bookCoverPlans ?? []).some((plan) => plan.id === coverPlanId)) throw new Error(`Book cover plan "${coverPlanId}" already exists.`);
    const plan = workspace.createCover({ journal, layout: rendered.layout, bookId: required(input.bookId, "Book id"), coverPlanId, author: required(input.author, "Author"), frontPrompt: required(input.frontPrompt, "Front cover direction"), backText: required(input.backText, "Back cover text"), publishing: { platform: "kdp", binding: input.binding === "hardcover" ? "hardcover" : "paperback", interiorType: input.interiorType === "premium-color" || input.interiorType === "standard-color" ? input.interiorType : "black-white", paperType: input.paperType === "cream" || input.paperType === "groundwood" ? input.paperType : "white", bleedInches: 0.125, readingDirection: "ltr" } });
    let next = withProjectMemories(project, memory.toPortableState());
    next = withProjectBookCoverPlans(next, [...(project.bookCoverPlans ?? []), plan]);
    await projects.save(next);
    json(res, 201, { plan, layout: rendered.layout }); return true;
  }
  if (url.pathname === `/api/projects/${projectId}/journal/cover-plans` && req.method === "GET") { json(res, 200, project.bookCoverPlans ?? []); return true; }
  return false;
}

function contentType(pathname: string): string {
  switch (extname(pathname).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".svg": return "image/svg+xml";
    default: return "application/octet-stream";
  }
}

async function serveStatic(res: ServerResponse, pathname: string): Promise<void> {
  const requested = pathname === "/" ? "/guided-journal.html" : pathname;
  const safe = normalize(requested).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]/, "");
  if (!safe.startsWith("guided-journal") && safe !== "styles.css" && !safe.startsWith("icon-")) { json(res, 404, { error: "Not found." }); return; }
  try {
    const value = await readFile(join(publicRoot, safe));
    res.writeHead(200, { "content-type": contentType(safe), "cache-control": "no-cache", "x-content-type-options": "nosniff" });
    res.end(value);
  } catch { json(res, 404, { error: "Not found." }); }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);
    if (url.pathname.startsWith("/api/")) {
      if (!(await handleApi(req, res, url))) json(res, 404, { error: "API route not found." });
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    json(res, 400, { error: message });
  }
});

server.listen(port, host, () => console.log(`Author's Forge Guided Journal Office: http://${host}:${port}`));
