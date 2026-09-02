import { randomUUID } from "node:crypto";
import { createKnowledgeGapHypothesis, dismissKnowledgeGap, markKnowledgeGapResearched, type KnowledgeGapHypothesis, type KnowledgeGapPriority } from "../domain/knowledge-gap";
import { RESEARCH_DOMAINS, type ResearchDomain } from "../domain/research";
import { getBook, getChapter, getScene, validateStudioWorkspace, type StudioWorkspaceState } from "../domain/studio-workspace";
import type { ProjectState } from "../domain/project";
import type { ProjectStorePort } from "./project-store-port";
import { ProjectMemoryStore } from "./project-memory-store";
import { generateProjectText, type AiGenerationResult } from "../infrastructure/ai-provider";
import type { FileKnowledgeGapStore } from "../infrastructure/file-knowledge-gap-store";
import { StudioLiveResearchService, type StudioLiveResearchResult } from "./studio-live-research";

const MAX_GAPS_PER_SCAN = 8;
const MAX_MANUSCRIPT_EXCERPT = 24_000;

export interface KnowledgeGapScanInput {
  readonly focus?: string;
  readonly maxGaps?: number;
  readonly bookId?: string;
  readonly chapterId?: string;
  readonly sceneId?: string;
}

export interface KnowledgeGapDetection {
  readonly domain: ResearchDomain;
  readonly question: string;
  readonly researchedBecause: string;
  readonly basis: string;
  readonly priority: KnowledgeGapPriority;
}

export interface KnowledgeGapDetectionResult {
  readonly provider: string;
  readonly model: string;
  readonly requestId?: string;
  readonly gaps: readonly KnowledgeGapDetection[];
}

export type KnowledgeGapDetector = (project: ProjectState, input: Required<Pick<KnowledgeGapScanInput, "maxGaps">> & KnowledgeGapScanInput) => Promise<KnowledgeGapDetectionResult>;
export type LiveResearchRunner = Pick<StudioLiveResearchService, "research">;

export interface KnowledgeGapScanResult {
  readonly gaps: readonly KnowledgeGapHypothesis[];
  readonly detectedCount: number;
  readonly persistedCount: number;
  readonly duplicateCount: number;
  readonly provider: string;
  readonly model: string;
  readonly requestId?: string;
  readonly canonEligible: false;
  readonly evidenceRequired: true;
}

/**
 * Proactive discovery layer for Research. Radar output is a durable question
 * queue only. It never writes Project Brain memory and never creates canon.
 */
export class StudioKnowledgeGapRadarService {
  constructor(
    private readonly projects: Pick<ProjectStorePort, "load">,
    private readonly gaps: FileKnowledgeGapStore,
    private readonly detector: KnowledgeGapDetector = detectKnowledgeGapsWithForgeAi,
    private readonly liveResearch: LiveResearchRunner = new StudioLiveResearchService(projects as never),
  ) {}

  async list(projectId: string): Promise<readonly KnowledgeGapHypothesis[]> {
    await this.requireProject(projectId);
    return this.gaps.list(projectIdValue(projectId));
  }

  async scan(projectId: string, input: KnowledgeGapScanInput = {}): Promise<KnowledgeGapScanResult> {
    const project = await this.requireProject(projectId);
    const normalized = normalizeScanInput(project, input);
    const detected = await this.detector(project, normalized);
    if (!detected.provider.trim() || !detected.model.trim()) throw new Error("Knowledge Gap Radar detector did not identify the real AI provider/model used.");
    if (!Array.isArray(detected.gaps)) throw new Error("Knowledge Gap Radar detector returned invalid gaps.");
    if (detected.gaps.length > normalized.maxGaps) throw new Error(`Knowledge Gap Radar returned more than the requested ${normalized.maxGaps} gaps.`);

    const existing = await this.gaps.list(project.metadata.id);
    const seenQuestions = new Set(existing.filter((gap) => gap.status !== "dismissed").map((gap) => normalizedQuestion(gap.question)));
    const now = new Date().toISOString();
    const unique: KnowledgeGapHypothesis[] = [];
    let duplicateCount = 0;
    for (const candidate of detected.gaps) {
      validateDetection(candidate);
      const key = normalizedQuestion(candidate.question);
      if (seenQuestions.has(key)) { duplicateCount += 1; continue; }
      seenQuestions.add(key);
      unique.push(createKnowledgeGapHypothesis({
        id: `knowledge-gap-${randomUUID()}`,
        projectId: project.metadata.id,
        domain: candidate.domain,
        question: candidate.question,
        researchedBecause: candidate.researchedBecause,
        basis: candidate.basis,
        priority: candidate.priority,
        source: "ai",
        ...(normalized.bookId ? { bookId: normalized.bookId } : {}),
        ...(normalized.chapterId ? { chapterId: normalized.chapterId } : {}),
        ...(normalized.sceneId ? { sceneId: normalized.sceneId } : {}),
        provider: detected.provider,
        model: detected.model,
        ...(detected.requestId ? { requestId: detected.requestId } : {}),
        now,
      }));
    }
    const persisted = unique.length ? await this.gaps.appendMany(project.metadata.id, unique) : [];
    return {
      gaps: persisted,
      detectedCount: detected.gaps.length,
      persistedCount: persisted.length,
      duplicateCount,
      provider: detected.provider,
      model: detected.model,
      ...(detected.requestId ? { requestId: detected.requestId } : {}),
      canonEligible: false,
      evidenceRequired: true,
    };
  }

  async dismiss(projectId: string, gapId: string, reason = "Dismissed by the author."): Promise<KnowledgeGapHypothesis> {
    await this.requireProject(projectId);
    const gap = await this.requireGap(projectId, gapId);
    return this.gaps.replace(dismissKnowledgeGap(gap, reason));
  }

  async researchGap(projectId: string, gapId: string): Promise<{ gap: KnowledgeGapHypothesis; research: StudioLiveResearchResult }> {
    await this.requireProject(projectId);
    const gap = await this.requireGap(projectId, gapId);
    if (gap.status === "dismissed") throw new Error(`Knowledge gap "${gap.id}" is dismissed. Re-scan or create a new gap before researching it.`);
    if (gap.status === "researched") throw new Error(`Knowledge gap "${gap.id}" has already been researched.`);

    // Source-backed research persists first. If it fails, the gap remains open.
    const research = await this.liveResearch.research(projectIdValue(projectId), {
      domain: gap.domain,
      question: gap.question,
      researchedBecause: gap.researchedBecause,
      ...(gap.bookId ? { bookId: gap.bookId } : {}),
      ...(gap.chapterId ? { chapterId: gap.chapterId } : {}),
      ...(gap.sceneId ? { sceneId: gap.sceneId } : {}),
    });
    const current = await this.requireGap(projectId, gapId);
    const completed = await this.gaps.replace(markKnowledgeGapResearched(current, research.persistedMemoryIds));
    return { gap: completed, research };
  }

  private async requireProject(projectId: string): Promise<ProjectState> {
    const id = projectIdValue(projectId);
    const project = await this.projects.load(id);
    if (!project) throw new Error(`Project "${id}" not found.`);
    return project;
  }

  private async requireGap(projectId: string, gapId: string): Promise<KnowledgeGapHypothesis> {
    const gap = await this.gaps.get(projectIdValue(projectId), identifier(gapId, "Knowledge gap id"));
    if (!gap) throw new Error(`Knowledge gap "${gapId}" not found.`);
    return gap;
  }
}

export async function detectKnowledgeGapsWithForgeAi(project: ProjectState, input: Required<Pick<KnowledgeGapScanInput, "maxGaps">> & KnowledgeGapScanInput): Promise<KnowledgeGapDetectionResult> {
  const memory = new ProjectMemoryStore();
  memory.restore(project.memories);
  const excerpt = manuscriptExcerpt(project.studioWorkspace, input);
  const focus = input.focus?.trim() || "Find concrete factual details an author should verify before relying on them in this manuscript.";
  const scope = [input.bookId && `book=${input.bookId}`, input.chapterId && `chapter=${input.chapterId}`, input.sceneId && `scene=${input.sceneId}`].filter(Boolean).join(", ") || "whole project";
  const user = [
    `Project: ${project.metadata.title}`,
    `Scan scope: ${scope}`,
    `Author focus: ${focus}`,
    excerpt ? `Manuscript/workspace material to inspect:\n${excerpt}` : "No manuscript text exists in this scope yet. Inspect the available Project Brain context and only surface a gap if there is a concrete research need.",
    `Return at most ${input.maxGaps} high-value research questions.`,
  ].join("\n\n");

  const result = await generateProjectText({
    memory,
    context: {
      projectId: project.metadata.id,
      includeWorkingState: true,
      queryTerms: tokenizeFocus(focus),
      limit: 96,
    },
    task: "research",
    temperature: 0.1,
    maxOutputTokens: 2500,
    requiresInstructionFollowing: true,
    system: radarSystemPrompt(input.maxGaps),
    user,
  });
  return parseDetectorResult(result, input.maxGaps);
}

function radarSystemPrompt(maxGaps: number): string {
  return `You are Author's Forge Knowledge Gap Radar. Your only job is to identify factual research questions the author may need to investigate. Do NOT answer the questions. Do NOT invent facts, sources, dates, statistics, quotations, URLs, canon, or story events. A gap is a hypothesis about missing knowledge, not knowledge itself. Prefer concrete, manuscript-relevant questions over generic suggestions. Do not flag purely creative decisions unless real-world research would materially help the author. Base each gap on an observable manuscript/context cue and explain that cue in "basis" without claiming the unknown answer. Return no more than ${maxGaps} gaps.\n\nAllowed domains: ${RESEARCH_DOMAINS.join(", ")}.\nAllowed priorities: low, medium, high.\nReturn ONLY JSON in this exact shape: {"gaps":[{"domain":"one allowed domain","question":"a researchable question ending in ?","researchedBecause":"why verifying this helps the manuscript","basis":"the specific manuscript/context cue that exposed the uncertainty","priority":"low|medium|high"}]}.`;
}

function parseDetectorResult(result: AiGenerationResult, maxGaps: number): KnowledgeGapDetectionResult {
  const raw = result.text.trim();
  const source = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? raw;
  let parsed: unknown;
  try { parsed = JSON.parse(source); }
  catch { throw new Error("Knowledge Gap Radar AI did not return valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Knowledge Gap Radar AI returned an invalid object.");
  const rows = (parsed as Record<string, unknown>).gaps;
  if (!Array.isArray(rows)) throw new Error("Knowledge Gap Radar AI response must contain a gaps array.");
  if (rows.length > maxGaps) throw new Error(`Knowledge Gap Radar AI returned more than ${maxGaps} gaps.`);
  const gaps = rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Knowledge Gap Radar AI returned an invalid gap entry.");
    const value = row as Record<string, unknown>;
    const candidate: KnowledgeGapDetection = {
      domain: enumValue(value.domain, RESEARCH_DOMAINS, "knowledge gap domain") as ResearchDomain,
      question: text(value.question, "Knowledge gap question", 3000),
      researchedBecause: text(value.researchedBecause, "Knowledge gap rationale", 3000),
      basis: text(value.basis, "Knowledge gap basis", 5000),
      priority: enumValue(value.priority, ["low", "medium", "high"] as const, "knowledge gap priority") as KnowledgeGapPriority,
    };
    validateDetection(candidate);
    return candidate;
  });
  return {
    provider: result.provider,
    model: result.model,
    ...(result.requestId ? { requestId: result.requestId } : {}),
    gaps,
  };
}

function normalizeScanInput(project: ProjectState, input: KnowledgeGapScanInput): Required<Pick<KnowledgeGapScanInput, "maxGaps">> & KnowledgeGapScanInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Knowledge gap scan input must be an object.");
  const maxGaps = input.maxGaps === undefined ? 6 : Number(input.maxGaps);
  if (!Number.isInteger(maxGaps) || maxGaps < 1 || maxGaps > MAX_GAPS_PER_SCAN) throw new Error(`Knowledge gap maxGaps must be an integer from 1 to ${MAX_GAPS_PER_SCAN}.`);
  const focus = optionalText(input.focus, "Knowledge gap scan focus", 5000);
  const bookId = optionalIdentifier(input.bookId, "Knowledge gap book id");
  const chapterId = optionalIdentifier(input.chapterId, "Knowledge gap chapter id");
  const sceneId = optionalIdentifier(input.sceneId, "Knowledge gap scene id");
  if (chapterId && !bookId) throw new Error("Knowledge gap chapter scope requires a book id.");
  if (sceneId && (!bookId || !chapterId)) throw new Error("Knowledge gap scene scope requires book and chapter ids.");
  if (bookId) {
    if (!project.studioWorkspace) throw new Error(`Book "${bookId}" cannot be scoped because this project has no Studio workspace.`);
    const workspace = validateStudioWorkspace(project.studioWorkspace);
    const book = getBook(workspace, bookId);
    if (chapterId) {
      const chapter = getChapter(book, chapterId);
      if (sceneId) getScene(book, chapter.id, sceneId);
    }
  }
  return {
    maxGaps,
    ...(focus ? { focus } : {}),
    ...(bookId ? { bookId } : {}),
    ...(chapterId ? { chapterId } : {}),
    ...(sceneId ? { sceneId } : {}),
  };
}

function manuscriptExcerpt(workspaceValue: StudioWorkspaceState | undefined, input: KnowledgeGapScanInput): string {
  if (!workspaceValue) return "";
  const workspace = validateStudioWorkspace(workspaceValue);
  const books = input.bookId ? [getBook(workspace, input.bookId)] : workspace.books.filter((book) => book.lifecycle !== "archived");
  const chunks: string[] = [];
  for (const book of books) {
    chunks.push(`BOOK: ${book.title} (${book.kind})\nDescription: ${book.description || "(none)"}`);
    const chapters = input.chapterId ? [getChapter(book, input.chapterId)] : book.chapters.filter((chapter) => chapter.lifecycle !== "archived");
    for (const chapter of chapters) {
      chunks.push(`CHAPTER ${chapter.number}: ${chapter.title}\nSynopsis: ${chapter.synopsis || "(none)"}`);
      const scenes = input.sceneId ? [getScene(book, chapter.id, input.sceneId)] : chapter.scenes.filter((scene) => scene.lifecycle !== "archived");
      for (const scene of scenes) {
        chunks.push(`SCENE ${scene.number}: ${scene.title}\nSynopsis: ${scene.synopsis || "(none)"}\nContent:\n${scene.content || "(empty)"}`);
        if (chunks.join("\n\n").length >= MAX_MANUSCRIPT_EXCERPT) return chunks.join("\n\n").slice(0, MAX_MANUSCRIPT_EXCERPT);
      }
    }
  }
  return chunks.join("\n\n").slice(0, MAX_MANUSCRIPT_EXCERPT);
}

function validateDetection(candidate: KnowledgeGapDetection): void {
  enumValue(candidate.domain, RESEARCH_DOMAINS, "knowledge gap domain");
  enumValue(candidate.priority, ["low", "medium", "high"] as const, "knowledge gap priority");
  const question = text(candidate.question, "Knowledge gap question", 3000);
  if (!question.endsWith("?")) throw new Error("Knowledge gap question must be phrased as a question.");
  text(candidate.researchedBecause, "Knowledge gap rationale", 3000);
  text(candidate.basis, "Knowledge gap basis", 5000);
}
function normalizedQuestion(value: string): string { return value.trim().toLocaleLowerCase().replace(/\s+/g, " ").replace(/[?!.]+$/g, ""); }
function tokenizeFocus(value: string): string[] { return [...new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu) ?? [])].slice(0, 32); }
function projectIdValue(value: unknown): string { return identifier(value, "Project id"); }
function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 300 || /[\r\n]/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function optionalIdentifier(value: unknown, label: string): string | undefined { if (value === undefined || value === null || value === "") return undefined; return identifier(value, label); }
function optionalText(value: unknown, label: string, max: number): string | undefined { if (value === undefined || value === null || value === "") return undefined; return text(value, label, max); }
function text(value: unknown, label: string, max: number): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); const result = value.trim(); if (result.length > max) throw new Error(`${label} exceeds ${max} characters.`); return result; }
function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T { if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Invalid ${label}.`); return value as T; }
