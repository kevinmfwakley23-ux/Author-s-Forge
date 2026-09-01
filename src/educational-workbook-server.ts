import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { EducationalWorkbookOfficeService } from "./application/educational-workbook-office";
import { EducationalWorkbookIntelligenceService } from "./application/educational-workbook-intelligence";
import { EducationalWorkbookProductionService } from "./application/educational-workbook-production";
import { createEducationalWorkbookDifferentiationRoutes } from "./application/educational-workbook-differentiation-routes";
import { ProjectMemoryStore } from "./application/project-memory-store";
import {
  WORKBOOK_ACTIVITY_KINDS,
  WORKBOOK_DIFFICULTIES,
  WORKBOOK_GRADE_BANDS,
  WORKBOOK_SUBJECTS,
  type WorkbookActivity,
  type WorkbookActivityInput,
  type WorkbookActivityKind,
  type WorkbookDifficulty,
  type WorkbookGradeBand,
  type WorkbookSubject,
} from "./domain/educational-workbook";
import { createProject, withProjectMemories, type ProjectState } from "./domain/project";
import { FileEducationalWorkbookAiProposalStore } from "./infrastructure/file-educational-workbook-ai-proposal-store";
import { FileEducationalWorkbookStore } from "./infrastructure/file-educational-workbook-store";
import { aiRoutingTelemetry } from "./infrastructure/ai-provider";
import { discoverConfiguredAiModelResources } from "./infrastructure/ai-model-resources";
import { createForgeStudioRuntime } from "./infrastructure/forge-studio-runtime";

const port = Number(process.env.WORKBOOK_PORT ?? process.env.PORT ?? 4373);
const host = process.env.HOST ?? "127.0.0.1";
const dataRoot = process.env.FORGE_DATA_DIR ?? join(process.cwd(), ".forge-data");
const publicRoot = join(process.cwd(), "public");
const studioRuntime = createForgeStudioRuntime(dataRoot);
const projects = studioRuntime.projectStore;
const office = new EducationalWorkbookOfficeService(new FileEducationalWorkbookStore(join(dataRoot, "educational-workbooks.json")));
const proposals = new FileEducationalWorkbookAiProposalStore(join(dataRoot, "educational-workbook-ai-proposals.json"));
const production = new EducationalWorkbookProductionService();
const differentiationRoutes = createEducationalWorkbookDifferentiationRoutes({ office, storePath: join(dataRoot, "educational-workbook-differentiation.json") });

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
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
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))]
    : typeof value === "string"
      ? [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))]
      : [];
}

function number(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return value === undefined ? fallback : value === true;
}

function subject(value: unknown): WorkbookSubject {
  if (typeof value !== "string" || !WORKBOOK_SUBJECTS.includes(value as WorkbookSubject)) throw new Error("Invalid workbook subject.");
  return value as WorkbookSubject;
}

function subjects(value: unknown): WorkbookSubject[] {
  return strings(value).map(subject);
}

function activityKind(value: unknown): WorkbookActivityKind {
  if (typeof value !== "string" || !WORKBOOK_ACTIVITY_KINDS.includes(value as WorkbookActivityKind)) throw new Error("Invalid workbook activity kind.");
  return value as WorkbookActivityKind;
}

function activityKinds(value: unknown): WorkbookActivityKind[] {
  return strings(value).map(activityKind);
}

function difficulty(value: unknown): WorkbookDifficulty {
  const candidate = value === undefined ? "practice" : value;
  if (typeof candidate !== "string" || !WORKBOOK_DIFFICULTIES.includes(candidate as WorkbookDifficulty)) throw new Error("Invalid workbook difficulty.");
  return candidate as WorkbookDifficulty;
}

function gradeBand(value: unknown): WorkbookGradeBand {
  if (typeof value !== "string" || !WORKBOOK_GRADE_BANDS.includes(value as WorkbookGradeBand)) throw new Error("Invalid workbook grade band.");
  return value as WorkbookGradeBand;
}

function gradeBands(value: unknown): WorkbookGradeBand[] {
  const bands = strings(value).map(gradeBand);
  if (!bands.length) throw new Error("At least one workbook grade band is required.");
  return bands;
}

function activityInput(projectId: string, input: Record<string, unknown>, fallbackId?: string): WorkbookActivityInput {
  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : fallbackId ?? `activity-${randomUUID()}`,
    projectId,
    subject: subject(input.subject),
    gradeBands: gradeBands(input.gradeBands),
    kind: activityKind(input.kind),
    difficulty: difficulty(input.difficulty),
    prompt: required(input.prompt, "Activity prompt"),
    choices: strings(input.choices),
    ...(typeof input.answer === "string" && input.answer.trim() ? { answer: input.answer.trim() } : {}),
    ...(typeof input.explanation === "string" && input.explanation.trim() ? { explanation: input.explanation.trim() } : {}),
    standards: strings(input.standards),
    tags: strings(input.tags),
    points: Math.trunc(number(input.points, 1)),
    enabled: input.enabled !== false,
    ...(typeof input.now === "string" ? { now: input.now } : {}),
  };
}

function memoryFor(project: ProjectState): ProjectMemoryStore {
  const memory = new ProjectMemoryStore();
  memory.restore(project.memories);
  return memory;
}

async function persistMemories(project: ProjectState, memory: ProjectMemoryStore, now = new Date().toISOString()): Promise<ProjectState> {
  const next = withProjectMemories(project, memory.toPortableState(), now);
  await projects.save(next);
  return next;
}

function aiStatus() {
  const resources = discoverConfiguredAiModelResources(process.env);
  return {
    configured: resources.length > 0,
    resources: resources.map((resource) => ({
      provider: resource.provider,
      model: resource.model,
      contextWindow: resource.capabilities.contextWindow,
      maxOutputTokens: resource.capabilities.maxOutputTokens,
      remainingQuota: resource.remainingQuota,
      quotaLimit: resource.quotaLimit,
    })),
    routing: aiRoutingTelemetry(),
  };
}

function proposalImport(activity: WorkbookActivity): Omit<WorkbookActivityInput, "projectId"> {
  return {
    id: activity.id,
    subject: activity.subject,
    gradeBands: activity.gradeBands,
    kind: activity.kind,
    difficulty: activity.difficulty,
    prompt: activity.prompt,
    ...(activity.choices ? { choices: activity.choices } : {}),
    ...(activity.answer ? { answer: activity.answer } : {}),
    ...(activity.explanation ? { explanation: activity.explanation } : {}),
    standards: activity.standards,
    tags: activity.tags,
    points: activity.points,
    enabled: activity.enabled,
    now: activity.createdAt,
  };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (url.pathname === "/api/health" && req.method === "GET") {
    json(res, 200, {
      ok: true,
      service: "authors-forge-educational-workbook-office",
      sharedDataRoot: dataRoot,
      forgeCore: studioRuntime.core.readiness(),
      ai: aiStatus(),
      gradeBands: WORKBOOK_GRADE_BANDS,
      subjects: WORKBOOK_SUBJECTS,
      activityKinds: WORKBOOK_ACTIVITY_KINDS,
      difficulties: WORKBOOK_DIFFICULTIES,
    });
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
  if (!project) {
    json(res, 404, { error: "Project not found." });
    return true;
  }

  if (await differentiationRoutes(req, res, url, projectId)) return true;

  if (url.pathname === `/api/projects/${projectId}` && req.method === "GET") {
    const [activities, workbooks, aiProposals] = await Promise.all([
      office.listActivities(projectId),
      office.listWorkbooks(projectId),
      proposals.list(projectId),
    ]);
    json(res, 200, {
      project: project.metadata,
      activityCount: activities.length,
      workbookCount: workbooks.length,
      memoryCount: project.memories.length,
      aiProposalCount: aiProposals.length,
      pendingAiProposalCount: aiProposals.filter((proposal) => proposal.status === "pending").length,
      ai: aiStatus(),
    });
    return true;
  }

  if (url.pathname === `/api/projects/${projectId}/workbooks/library` && req.method === "GET") {
    json(res, 200, { activities: await office.listActivities(projectId) });
    return true;
  }

  if (url.pathname === `/api/projects/${projectId}/workbooks/library/activities` && req.method === "POST") {
    const input = await body(req);
    const activity = await office.createActivity(activityInput(projectId, input));
    json(res, 201, activity);
    return true;
  }

  if (url.pathname === `/api/projects/${projectId}/workbooks/library/import` && req.method === "POST") {
    const input = await body(req);
    if (!Array.isArray(input.activities) || !input.activities.length) throw new Error("Import requires a non-empty activities array.");
    const activities = input.activities.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Imported activity ${index + 1} must be an object.`);
      const parsed = activityInput(projectId, item as Record<string, unknown>, `activity-${randomUUID()}`);
      const { projectId: _projectId, ...withoutProject } = parsed;
      return withoutProject;
    });
    json(res, 200, { activities: await office.importActivities(projectId, activities) });
    return true;
  }

  const activityMatch = url.pathname.match(new RegExp(`^/api/projects/${projectId}/workbooks/library/activities/([^/]+)$`));
  if (activityMatch && req.method === "DELETE") {
    const removed = await office.removeActivity(projectId, decodeURIComponent(activityMatch[1]));
    json(res, removed ? 200 : 404, removed ? { removed: true } : { error: "Workbook activity not found." });
    return true;
  }

  if (url.pathname === `/api/projects/${projectId}/workbooks/ai/proposals` && req.method === "GET") {
    json(res, 200, await proposals.list(projectId));
    return true;
  }

  if (url.pathname === `/api/projects/${projectId}/workbooks/ai/activities` && req.method === "POST") {
    const input = await body(req);
    const memory = memoryFor(project);
    const intelligence = new EducationalWorkbookIntelligenceService(memory);
    const proposal = await intelligence.proposeActivities({
      projectId,
      subject: subject(input.subject),
      gradeBands: gradeBands(input.gradeBands),
      kind: activityKind(input.kind),
      count: Math.trunc(number(input.count, 0)),
      learningObjective: required(input.learningObjective, "Learning objective"),
      difficulty: difficulty(input.difficulty),
      standards: strings(input.standards),
      tags: strings(input.tags),
      ...(typeof input.audience === "string" && input.audience.trim() ? { audience: input.audience.trim() } : {}),
    });
    const stored = await proposals.create({ id: `workbook-ai-${randomUUID()}`, projectId, proposal });
    json(res, 201, stored);
    return true;
  }

  const proposalMatch = url.pathname.match(new RegExp(`^/api/projects/${projectId}/workbooks/ai/proposals/([^/]+)/(approve|reject)$`));
  if (proposalMatch && req.method === "POST") {
    const proposalId = decodeURIComponent(proposalMatch[1]);
    const action = proposalMatch[2];
    const proposal = await proposals.get(projectId, proposalId);
    if (!proposal) {
      json(res, 404, { error: "Workbook AI proposal not found." });
      return true;
    }
    if (action === "reject") {
      json(res, 200, await proposals.decide(projectId, proposalId, "rejected"));
      return true;
    }
    if (proposal.status === "rejected") throw new Error("Rejected workbook AI proposal cannot be approved.");
    const activities = await office.importActivities(projectId, proposal.activities.map(proposalImport));
    const decided = await proposals.decide(projectId, proposalId, "approved");
    json(res, 200, { proposal: decided, activities });
    return true;
  }

  if (url.pathname === `/api/projects/${projectId}/workbooks/editions` && req.method === "GET") {
    json(res, 200, await office.listWorkbooks(projectId));
    return true;
  }

  if (url.pathname === `/api/projects/${projectId}/workbooks/editions` && req.method === "POST") {
    const input = await body(req);
    const subjectFilter = subjects(input.subjects);
    const kindFilter = activityKinds(input.kinds);
    const workbook = await office.createWorkbook({
      id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : `workbook-${randomUUID()}`,
      projectId,
      title: required(input.title, "Workbook title"),
      ...(typeof input.subtitle === "string" && input.subtitle.trim() ? { subtitle: input.subtitle.trim() } : {}),
      gradeBand: gradeBand(input.gradeBand),
      seed: required(input.seed, "Workbook seed"),
      activityCount: Math.trunc(number(input.activityCount, 0)),
      learningObjectives: strings(input.learningObjectives),
      directions: strings(input.directions),
      includeAnswerKey: input.includeAnswerKey !== false,
      pool: {
        ...(subjectFilter.length ? { subjects: subjectFilter } : {}),
        ...(kindFilter.length ? { kinds: kindFilter } : {}),
        ...(strings(input.standards).length ? { standards: strings(input.standards) } : {}),
        ...(strings(input.tags).length ? { tags: strings(input.tags) } : {}),
        ...(strings(input.activityIds).length ? { activityIds: strings(input.activityIds) } : {}),
        ...(strings(input.excludedActivityIds).length ? { excludedActivityIds: strings(input.excludedActivityIds) } : {}),
      },
    });
    const memory = memoryFor(project);
    new EducationalWorkbookIntelligenceService(memory).rememberEdition(workbook);
    await persistMemories(project, memory);
    json(res, 201, workbook);
    return true;
  }

  const editionMatch = url.pathname.match(new RegExp(`^/api/projects/${projectId}/workbooks/editions/([^/]+)$`));
  if (editionMatch && req.method === "GET") {
    const workbook = await office.getWorkbook(projectId, decodeURIComponent(editionMatch[1]));
    json(res, workbook ? 200 : 404, workbook ?? { error: "Educational Workbook edition not found." });
    return true;
  }

  if (url.pathname === `/api/projects/${projectId}/workbooks/render` && req.method === "POST") {
    const input = await body(req);
    const workbook = await office.getWorkbook(projectId, required(input.workbookId, "Workbook edition id"));
    if (!workbook) throw new Error("Educational Workbook edition not found.");
    const options = input.options && typeof input.options === "object" && !Array.isArray(input.options) ? input.options as Record<string, unknown> : {};
    const rendered = production.renderPdf({
      workbook,
      bookId: required(input.bookId, "Book id"),
      author: required(input.author, "Author"),
      ...(typeof input.copyrightHolder === "string" && input.copyrightHolder.trim() ? { copyrightHolder: input.copyrightHolder.trim() } : {}),
      options: {
        trimWidthInches: number(options.trimWidthInches, 8.5),
        trimHeightInches: number(options.trimHeightInches, 11),
        marginInches: number(options.marginInches, 0.65),
        activityFontSizePt: number(options.activityFontSizePt, 13),
        answerFontSizePt: number(options.answerFontSizePt, 10),
        includeStudentNameLine: bool(options.includeStudentNameLine, true),
        includeLearningObjectivesPage: bool(options.includeLearningObjectivesPage, true),
        includeDirectionsPage: bool(options.includeDirectionsPage, true),
        includeAnswerKey: bool(options.includeAnswerKey, true),
      },
    });
    json(res, 201, rendered);
    return true;
  }

  return false;
}

const mimeTypes: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function serveStatic(res: ServerResponse, pathname: string): Promise<void> {
  const requested = pathname === "/" ? "/educational-workbooks.html" : pathname;
  const relative = normalize(decodeURIComponent(requested)).replace(/^([/\\])+/, "");
  const filePath = join(publicRoot, relative);
  if (!filePath.startsWith(publicRoot)) {
    json(res, 403, { error: "Forbidden." });
    return;
  }
  try {
    const bytes = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(bytes);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") {
      json(res, 404, { error: "Not found." });
      return;
    }
    throw error;
  }
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
    if (!res.headersSent) json(res, 400, { error: message });
    else res.end();
  }
});

server.listen(port, host, () => {
  console.log(`Author's Forge Educational Workbook Office listening on http://${host}:${port}`);
});