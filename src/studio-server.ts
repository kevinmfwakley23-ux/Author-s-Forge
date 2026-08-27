import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { FileProjectStore } from "./infrastructure/file-project-store";
import { createProject, withProjectBookGenome, withProjectCharacters, withProjectAiCollaborationPolicy } from "./domain/project";
import { createMemoryRecord, type MemoryAuthority, type MemoryClass } from "./domain/memory";
import { assembleWritingContext, CONTEXT_INCLUSION_MODES, type ContextSectionPolicy } from "./domain/context-assembly";
import { BookGenomeService, FinalProductAuditService, GovernanceService } from "./application/final-product-systems";
import { DELIVERY_AUDIT_CATEGORIES as FINAL_AUDIT_CATEGORIES, type BookGenomeNode, type FinalDeliveryCheck } from "./domain/final-product-systems";
import { createCharacter, updateCharacter, type CharacterProfile } from "./domain/character-bible";
import { createStudioWorkspace, addWorkspaceBook, addWorkspaceChapter, addWorkspaceScene, getBook, getScene, saveSceneContent, setActiveBook, validateStudioWorkspace, createWorkspaceBook, type StudioWorkspaceState } from "./domain/studio-workspace";
import { generateText } from "./infrastructure/ai-provider";
import { ManuscriptProductionService } from "./application/manuscript-production";
import type { ProductionFormat } from "./domain/manuscript-production";
import { IntelligentEditingService } from "./application/intelligent-editing";
import { EDITOR_ROLES, type EditorRole } from "./domain/intelligent-editing";
import { createAiCollaborationPolicy, AI_COLLABORATION_MODES, type AiCollaborationMode } from "./domain/ai-collaboration";

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";
const dataRoot = process.env.FORGE_DATA_DIR ?? join(process.cwd(), ".forge-data");
const publicRoot = join(process.cwd(), "public");
const store = new FileProjectStore(dataRoot);
const genome = new BookGenomeService();
const audit = new FinalProductAuditService();
const governance = new GovernanceService();
const production = new ManuscriptProductionService();
const editor = new IntelligentEditingService();
const defaultProjectId = "forge-studio";
const MEMORY_CLASSES: readonly MemoryClass[] = ["author-memory", "project-memory", "story-canon", "character-memory", "relationship-memory", "location-memory", "timeline-memory", "style-memory", "research-memory", "creative-note", "working-draft", "hypothesis", "open-thread", "visual-identity", "production-memory", "publishing-memory", "marketing-memory", "generated-alternative"];
const MEMORY_AUTHORITIES: readonly MemoryAuthority[] = ["proposed", "working", "verified", "authoritative", "superseded", "archived"];

type ProjectWithWorkspace = Awaited<ReturnType<FileProjectStore["load"]>> & { studioWorkspace?: StudioWorkspaceState };

async function ensureDefaultProject(): Promise<void> { if (!(await store.exists(defaultProjectId))) await store.create(createProject({ id: defaultProjectId, title: "My First Forge Book" })); }
function json(res: ServerResponse, status: number, value: unknown): void { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(JSON.stringify(value)); }
function text(res: ServerResponse, status: number, value: string, contentType: string): void { res.writeHead(status, { "content-type": contentType, "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(value); }
async function body(req: IncomingMessage): Promise<Record<string, unknown>> { let raw = ""; for await (const chunk of req) raw += String(chunk); if (raw.length > 8 * 1024 * 1024) throw new Error("Request body exceeds 8 MiB limit."); if (!raw.trim()) return {}; const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON object body required."); return parsed as Record<string, unknown>; }
function projectIdFrom(pathname: string): string | null { const match = pathname.match(/^\/api\/projects\/([A-Za-z0-9_-]+)(?:\/|$)/); return match?.[1] ?? null; }
function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T { if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Invalid ${label}.`); return value as T; }
function workspaceOf(project: ProjectWithWorkspace): StudioWorkspaceState { return project?.studioWorkspace ? validateStudioWorkspace(project.studioWorkspace) : createStudioWorkspace(); }
function saveWorkspace(project: ProjectWithWorkspace, workspace: StudioWorkspaceState): ProjectWithWorkspace { return { ...project, studioWorkspace: validateStudioWorkspace(workspace), metadata: { ...project.metadata, updatedAt: new Date().toISOString() } } as ProjectWithWorkspace; }

async function listProjects(): Promise<Array<{ id: string; title: string; updatedAt: string }>> {
  const root = join(dataRoot, "projects");
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const projects: Array<{ id: string; title: string; updatedAt: string }> = [];
    for (const entry of entries) { if (!entry.isDirectory() || !/^[A-Za-z0-9_-]+$/.test(entry.name)) continue; const project = await store.load(entry.name); if (project) projects.push({ id: project.metadata.id, title: project.metadata.title, updatedAt: project.metadata.updatedAt }); }
    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (error) { if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT") return []; throw error; }
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (url.pathname === "/api/health" && req.method === "GET") { json(res, 200, { ok: true, service: "authors-forge-studio", projectId: defaultProjectId, port, ai: { openai: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL), ollama: Boolean(process.env.OLLAMA_BASE_URL && process.env.OLLAMA_MODEL) } }); return true; }
  if (url.pathname === "/api/governance" && req.method === "GET") { json(res, 200, { ownership: governance.ownershipPolicy(), accessibility: governance.accessibilityProfile() }); return true; }
  if (url.pathname === "/api/projects" && req.method === "GET") { json(res, 200, await listProjects()); return true; }
  if (url.pathname === "/api/projects" && req.method === "POST") { const input = await body(req); const project = createProject({ id: String(input.id ?? ""), title: String(input.title ?? "") }); await store.create(project); json(res, 201, project); return true; }
  const projectId = projectIdFrom(url.pathname);
  if (!projectId) return false;
  const loaded = await store.load(projectId);
  if (!loaded) { json(res, 404, { error: "Project not found." }); return true; }
  const project = loaded as ProjectWithWorkspace;
  if (url.pathname === `/api/projects/${projectId}` && req.method === "GET") { json(res, 200, project); return true; }
  if (url.pathname === `/api/projects/${projectId}/collaboration` && req.method === "GET") { json(res, 200, project.aiCollaborationPolicy ?? createAiCollaborationPolicy("co-pilot")); return true; }
  if (url.pathname === `/api/projects/${projectId}/collaboration` && req.method === "POST") { const input = await body(req); const policy = createAiCollaborationPolicy(enumValue(input.mode, AI_COLLABORATION_MODES, "collaboration mode") as AiCollaborationMode); await store.save(withProjectAiCollaborationPolicy(project, policy) as never); json(res, 200, policy); return true; }

  if (url.pathname === `/api/projects/${projectId}/workspace` && req.method === "GET") { json(res, 200, workspaceOf(project)); return true; }
  if (url.pathname === `/api/projects/${projectId}/workspace/activate` && req.method === "POST") { const input = await body(req); const workspace = setActiveBook(workspaceOf(project), String(input.bookId ?? "")); await store.save(saveWorkspace(project, workspace) as never); json(res, 200, workspace); return true; }
  if (url.pathname === `/api/projects/${projectId}/workspace/books` && req.method === "POST") { const input = await body(req); const workspace = addWorkspaceBook(workspaceOf(project), createWorkspaceBook({ id: String(input.id ?? `book-${randomUUID()}`), title: String(input.title ?? ""), kind: input.kind as never, description: String(input.description ?? "") })); await store.save(saveWorkspace(project, workspace) as never); json(res, 201, workspace.books.find((b) => b.id === workspace.activeBookId)); return true; }
  const bookMatch = url.pathname.match(new RegExp(`^/api/projects/${projectId}/workspace/books/([^/]+)/chapters$`));
  if (bookMatch && req.method === "POST") { const input = await body(req); const workspace = addWorkspaceChapter(workspaceOf(project), bookMatch[1], { id: String(input.id ?? `chapter-${randomUUID()}`), number: Number(input.number), title: String(input.title ?? ""), synopsis: String(input.synopsis ?? "") }); await store.save(saveWorkspace(project, workspace) as never); json(res, 201, getBook(workspace, bookMatch[1]).chapters.find((c) => c.id === String(input.id))); return true; }
  const chapterMatch = url.pathname.match(new RegExp(`^/api/projects/${projectId}/workspace/books/([^/]+)/chapters/([^/]+)/scenes$`));
  if (chapterMatch && req.method === "POST") { const input = await body(req); const workspace = addWorkspaceScene(workspaceOf(project), chapterMatch[1], chapterMatch[2], { id: String(input.id ?? `scene-${randomUUID()}`), number: Number(input.number), title: String(input.title ?? ""), synopsis: String(input.synopsis ?? "") }); await store.save(saveWorkspace(project, workspace) as never); json(res, 201, getBook(workspace, chapterMatch[1]).chapters.find((c) => c.id === chapterMatch[2])); return true; }
  const sceneContentMatch = url.pathname.match(new RegExp(`^/api/projects/${projectId}/workspace/books/([^/]+)/chapters/([^/]+)/scenes/([^/]+)/content$`));
  if (sceneContentMatch && req.method === "PUT") { const input = await body(req); const workspace = saveSceneContent(workspaceOf(project), sceneContentMatch[1], sceneContentMatch[2], sceneContentMatch[3], String(input.content ?? "")); await store.save(saveWorkspace(project, workspace) as never); const book = workspace.books.find((b) => b.id === sceneContentMatch[1])!; json(res, 200, getScene(book, sceneContentMatch[2], sceneContentMatch[3])); return true; }

  if (url.pathname === `/api/projects/${projectId}/memory` && req.method === "POST") {
    const input = await body(req); const memory = createMemoryRecord({ id: String(input.id ?? `memory-${randomUUID()}`), projectId, class: enumValue(input.class ?? "creative-note", MEMORY_CLASSES, "memory class"), authority: enumValue(input.authority ?? "working", MEMORY_AUTHORITIES, "memory authority"), summary: String(input.summary ?? ""), content: String(input.content ?? ""), provenance: [{ kind: "author", reference: String(input.reference ?? "studio"), recordedAt: new Date().toISOString() }], relatedMemoryIds: Array.isArray(input.relatedMemoryIds) ? input.relatedMemoryIds.map(String) : [], relevanceTags: Array.isArray(input.relevanceTags) ? input.relevanceTags.map(String) : [] });
    if (project.memories.some((m) => m.id === memory.id)) { json(res, 409, { error: `Memory id "${memory.id}" already exists.` }); return true; }
    await store.save({ ...project, memories: [...project.memories, memory], metadata: { ...project.metadata, updatedAt: new Date().toISOString() } } as never); json(res, 201, memory); return true;
  }
  if (url.pathname === `/api/projects/${projectId}/context` && req.method === "POST") {
    const input = await body(req); const policies = Array.isArray(input.policies) ? input.policies.map((item) => { if (!item || typeof item !== "object") throw new Error("Context policy must be an object."); const policy = item as Record<string, unknown>; const mode = enumValue(policy.mode, CONTEXT_INCLUSION_MODES, "context inclusion mode"); const key = String(policy.key ?? "").trim(); if (!key) throw new Error("Context policy key is required."); return { key, mode, ...(policy.maxWords === undefined ? {} : { maxWords: Number(policy.maxWords) }) }; }) as ContextSectionPolicy[] : undefined; json(res, 200, assembleWritingContext(project, { projectId, policies, query: input.query === undefined ? undefined : String(input.query), characterIds: Array.isArray(input.characterIds) ? input.characterIds.map(String) : undefined })); return true;
  }
  if (url.pathname === `/api/projects/${projectId}/characters` && req.method === "POST") { const input = await body(req); const character = createCharacter({ id: String(input.id ?? `character-${randomUUID()}`), projectId, profile: input.profile as CharacterProfile, reason: String(input.reason ?? "Initial character bible entry") }); await store.save(withProjectCharacters(project, [...(project.characters ?? []), character]) as never); json(res, 201, character); return true; }
  const characterMatch = url.pathname.match(new RegExp(`^/api/projects/${projectId}/characters/([^/]+)$`));
  if (characterMatch && req.method === "PUT") { const input = await body(req); const current = (project.characters ?? []).find((item) => item.id === characterMatch[1]); if (!current) { json(res, 404, { error: "Character not found." }); return true; } const next = updateCharacter(current, { characterId: current.id, changes: input.changes as never, reason: String(input.reason ?? "Author update"), actor: input.actor === "system" ? "system" : "author" }); await store.save(withProjectCharacters(project, (project.characters ?? []).map((item) => item.id === current.id ? next : item)) as never); json(res, 200, next); return true; }

  if (url.pathname === `/api/projects/${projectId}/edit` && req.method === "POST") {
    const input = await body(req); const roles = (Array.isArray(input.roles) ? input.roles : ["developmental", "continuity", "line", "copy", "proofreading"]).map((role) => enumValue(role, EDITOR_ROLES, "editorial role") as EditorRole); const report = editor.analyze({ document: { target: { projectId, manuscriptId: String(input.manuscriptId ?? "studio-workspace"), chapterId: input.chapterId === undefined ? undefined : String(input.chapterId), sceneId: input.sceneId === undefined ? undefined : String(input.sceneId) }, title: String(input.title ?? "Manuscript review"), text: String(input.text ?? ""), pov: input.pov as never, tense: input.tense as never, expectedCharacterNames: Array.isArray(input.expectedCharacterNames) ? input.expectedCharacterNames.map(String) : undefined, requiredFacts: Array.isArray(input.requiredFacts) ? input.requiredFacts.map(String) : undefined, unresolvedThreads: Array.isArray(input.unresolvedThreads) ? input.unresolvedThreads.map(String) : undefined, genreExpectations: Array.isArray(input.genreExpectations) ? input.genreExpectations.map(String) : undefined }, roles, reportId: String(input.reportId ?? `edit-${randomUUID()}`) }); json(res, 200, report); return true;
  }

  if (url.pathname === `/api/projects/${projectId}/ai/draft` && req.method === "POST") {
    const input = await body(req); const workspace = workspaceOf(project); const book = getBook(workspace, String(input.bookId ?? workspace.activeBookId ?? "")); const chapter = book.chapters.find((item) => item.id === String(input.chapterId ?? "")); if (!chapter) throw new Error("A valid chapter is required for AI drafting."); const focus = String(input.focus ?? chapter.synopsis ?? "").trim(); if (!focus) throw new Error("A scene focus or chapter synopsis is required."); const context = assembleWritingContext(project, { projectId, query: focus }); const recent = chapter.scenes.slice(-3).map((scene) => `${scene.title}\n${scene.content.slice(-3000)}`).join("\n\n"); const result = await generateText({ system: "You are the writing engine inside Author's Forge. The author owns canon and prose. Produce a candidate draft only. Never claim generated material is canon. Preserve the author's stated facts and voice constraints. Do not invent research as fact.", user: `PROJECT: ${project.metadata.title}\nBOOK: ${book.title}\nCHAPTER: ${chapter.number} ${chapter.title}\nFOCUS: ${focus}\n\nBOUND CONTEXT:\n${JSON.stringify(context)}\n\nRECENT SCENES:\n${recent}\n\nAUTHOR REQUEST:\n${String(input.instruction ?? "Draft the next scene in a publication-quality form while respecting the supplied context.")}`, temperature: Number(input.temperature ?? 0.7), maxOutputTokens: Number(input.maxOutputTokens ?? 5000) }); json(res, 200, { ...result, candidate: true, authorApprovalRequired: true }); return true;
  }
  if (url.pathname === `/api/projects/${projectId}/ai/image` && req.method === "POST") {
    const input = await body(req); const key = process.env.OPENAI_API_KEY?.trim(); const model = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1"; if (!key) throw new Error("OPENAI_API_KEY is required for image generation."); const prompt = String(input.prompt ?? "").trim(); if (!prompt) throw new Error("Image prompt is required."); const response = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ model, prompt, size: String(input.size ?? "1024x1024"), quality: String(input.quality ?? "high"), output_format: "png" }) }); const payload = await response.json().catch(() => ({})) as Record<string, unknown>; if (!response.ok) throw new Error(typeof payload.error === "object" && payload.error ? String((payload.error as Record<string, unknown>).message ?? `Image request failed (${response.status}).`) : `Image request failed (${response.status}).`); const first = Array.isArray(payload.data) ? payload.data[0] as Record<string, unknown> : undefined; if (!first || typeof first.b64_json !== "string") throw new Error("Image provider returned no PNG data."); const assetId = `image-${randomUUID()}`; const assetDir = join(dataRoot, "projects", projectId, "assets"); await mkdir(assetDir, { recursive: true }); await writeFile(join(assetDir, `${assetId}.png`), Buffer.from(first.b64_json, "base64")); json(res, 201, { id: assetId, provider: "openai", model, prompt, url: `/api/projects/${projectId}/assets/${assetId}.png` }); return true;
  }
  const assetMatch = url.pathname.match(new RegExp(`^/api/projects/${projectId}/assets/([A-Za-z0-9_-]+\\.png)$`));
  if (assetMatch && req.method === "GET") { try { const data = await readFile(join(dataRoot, "projects", projectId, "assets", assetMatch[1])); res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(data); } catch { text(res, 404, "Asset not found", "text/plain; charset=utf-8"); } return true; }

  if (url.pathname === `/api/projects/${projectId}/export` && req.method === "POST") {
    const input = await body(req); const workspace = workspaceOf(project); const book = getBook(workspace, String(input.bookId ?? workspace.activeBookId ?? "")); const chapters = book.chapters.map((chapter) => ({ id: chapter.id, number: chapter.number, title: chapter.title, scenes: chapter.scenes.map((scene) => ({ id: scene.id, title: scene.title, body: scene.content })) })); const format = enumValue(input.format ?? "docx", ["docx", "pdf", "epub", "kdp-docx", "kdp-pdf", "kdp-epub"] as const, "production format") as ProductionFormat; const artifact = production.render({ projectId, bookId: book.id, title: book.title, author: String(input.author ?? "Author"), chapters, frontMatter: [], backMatter: [] }, { format, pageSize: input.pageSize === "6x9" || input.pageSize === "5x8" || input.pageSize === "a4" ? input.pageSize : "letter", pageNumbers: true, includeTitlePage: true, includeToc: true }); json(res, 200, artifact); return true;
  }
  if (url.pathname === `/api/projects/${projectId}/genome` && req.method === "POST") { const input = await body(req); const nodes = Array.isArray(input.nodes) ? input.nodes as BookGenomeNode[] : []; const nextGenome = genome.create({ projectId, nodes }); await store.save(withProjectBookGenome(project, nextGenome) as never); json(res, 200, nextGenome); return true; }
  if (url.pathname === `/api/projects/${projectId}/genome/impact` && req.method === "POST") { const input = await body(req); const nodes = Array.isArray(input.nodes) ? input.nodes as BookGenomeNode[] : []; const graph = genome.create({ projectId, nodes }); json(res, 200, genome.impact(graph, String(input.changedNodeId ?? ""))); return true; }
  if (url.pathname === `/api/projects/${projectId}/delivery-audit` && req.method === "POST") { const input = await body(req); const checks = Array.isArray(input.checks) ? input.checks as FinalDeliveryCheck[] : FINAL_AUDIT_CATEGORIES.map((category) => ({ category, passed: false, message: "No audit evidence supplied.", blocking: true })); json(res, 200, audit.run({ id: String(input.id ?? `audit-${randomUUID()}`), projectId, checks })); return true; }
  return false;
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> { const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1); const safe = normalize(requested); if (safe.startsWith("..") || safe.includes("/../")) { text(res, 400, "Bad path", "text/plain; charset=utf-8"); return; } const file = join(publicRoot, safe); try { const data = await readFile(file); const type: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" }; res.writeHead(200, { "content-type": type[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'self'; connect-src 'self' https://api.openai.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'" }); res.end(data); } catch { text(res, 404, "Not found", "text/plain; charset=utf-8"); } }

const server = createServer(async (req, res) => { try { const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`); if (url.pathname.startsWith("/api/")) { if (await handleApi(req, res, url)) return; json(res, 404, { error: "API route not found." }); return; } if (req.method !== "GET" && req.method !== "HEAD") { json(res, 405, { error: "Method not allowed." }); return; } await serveStatic(req, res, url); } catch (error) { console.error(error); json(res, 400, { error: error instanceof Error ? error.message : "Request failed." }); } });
server.on("error", (error) => { console.error(error); process.exitCode = 1; });
ensureDefaultProject().then(() => server.listen(port, host, () => console.log(`Author's Forge Studio: http://${host}:${port}`))).catch((error) => { console.error(error); process.exitCode = 1; });
