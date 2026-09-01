import { createMemoryRecord, type MemoryRecord } from "../domain/memory";
import {
  createWorkbookActivity,
  type EducationalWorkbookPlan,
  type WorkbookActivity,
  type WorkbookActivityKind,
  type WorkbookDifficulty,
  type WorkbookGradeBand,
  type WorkbookSubject,
} from "../domain/educational-workbook";
import type { ProjectMemoryStore } from "./project-memory-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";

export interface WorkbookAiActivityRequest {
  readonly projectId: string;
  readonly subject: WorkbookSubject;
  readonly gradeBands: readonly WorkbookGradeBand[];
  readonly kind: WorkbookActivityKind;
  readonly count: number;
  readonly learningObjective: string;
  readonly difficulty?: WorkbookDifficulty;
  readonly standards?: readonly string[];
  readonly tags?: readonly string[];
  readonly audience?: string;
}

export interface WorkbookAiActivityProposal {
  readonly activities: readonly WorkbookActivity[];
  readonly ai: Pick<AiGenerationResult, "provider" | "model" | "requestId" | "optimization" | "attempts" | "usage" | "routing">;
}

export type ProjectAiGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;

/**
 * Shared-trunk intelligence bridge for Educational Workbooks.
 * It consumes Project Brain memory and the canonical live provider/model broker.
 * AI output is a proposal only; author approval is required before library persistence.
 */
export class EducationalWorkbookIntelligenceService {
  constructor(
    private readonly memory: ProjectMemoryStore,
    private readonly ai: ProjectAiGenerator = generateProjectText,
  ) {}

  async proposeActivities(request: WorkbookAiActivityRequest): Promise<WorkbookAiActivityProposal> {
    if (!Number.isInteger(request.count) || request.count < 1 || request.count > 100) throw new Error("AI workbook activity count must be an integer from 1 to 100.");
    const objective = required(request.learningObjective, "Learning objective");
    const gradeBands = [...new Set(request.gradeBands)];
    if (!gradeBands.length) throw new Error("AI workbook activity proposal requires at least one grade band.");
    const standards = unique(request.standards ?? []);
    const tags = unique(request.tags ?? []);
    const result = await this.ai({
      memory: this.memory,
      context: {
        projectId: request.projectId,
        taskMemoryClasses: ["author-memory", "project-memory", "research-memory", "decision-memory", "style-memory", "production-memory"],
        relevanceTags: ["educational-workbook", request.subject, ...tags],
        queryTerms: [request.subject, objective, ...gradeBands, ...(request.audience?.trim() ? [request.audience.trim()] : [])],
        includeWorkingState: true,
        limit: 30,
      },
      task: "writing",
      requiresInstructionFollowing: true,
      system: [
        "You are the Educational Workbook Office assistant inside Author's Forge.",
        "Use Project Brain context and the author's approved direction.",
        "Create original educational activities only. Do not fabricate source citations, standards certification, research findings, or answer truth.",
        "For scored activity types, provide an explicit correct answer. Multiple-choice answers must exactly match one choice. True/false answers must be exactly true or false.",
        "For writing-prompt activities, an answer may be omitted and an explanation may describe response expectations.",
        "Standards identifiers supplied by the author are constraints/metadata for review, not a claim that Forge has independently certified alignment.",
        "Return only valid JSON.",
      ].join(" "),
      user: [
        `Create exactly ${request.count} ${request.kind} activities for subject ${request.subject}.`,
        `Grade bands: ${gradeBands.join(", ")}.`,
        `Learning objective: ${objective}`,
        `Difficulty: ${request.difficulty ?? "practice"}.`,
        standards.length ? `Author-supplied standards/framework identifiers: ${standards.join(", ")}.` : "",
        tags.length ? `Tags: ${tags.join(", ")}.` : "",
        request.audience?.trim() ? `Audience context: ${request.audience.trim()}.` : "",
        'Return JSON shaped exactly as {"activities":[{"prompt":"...","choices":["..."],"answer":"...","explanation":"...","standards":["..."],"tags":["..."],"points":1}]}.',
        "Omit choices unless the requested activity type is multiple-choice.",
      ].filter(Boolean).join("\n"),
      temperature: 0.55,
      maxOutputTokens: Math.min(9000, Math.max(1200, request.count * 180)),
    });

    const parsed = parseObject(result.text, "AI workbook activity response");
    if (!Array.isArray(parsed.activities) || parsed.activities.length !== request.count) throw new Error(`AI workbook activity response must contain exactly ${request.count} activities.`);
    const now = new Date().toISOString();
    const seenPrompts = new Set<string>();
    const activities = parsed.activities.map((raw, index) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`AI workbook activity ${index + 1} must be an object.`);
      const item = raw as Record<string, unknown>;
      const prompt = required(item.prompt, `AI workbook activity ${index + 1} prompt`);
      const normalized = normalize(prompt);
      if (seenPrompts.has(normalized)) throw new Error("AI workbook proposal contains duplicate activity prompts.");
      seenPrompts.add(normalized);
      const choices = stringArray(item.choices);
      const answer = typeof item.answer === "string" && item.answer.trim() ? item.answer.trim() : undefined;
      const explanation = typeof item.explanation === "string" && item.explanation.trim() ? item.explanation.trim() : undefined;
      const proposedStandards = stringArray(item.standards);
      const proposedTags = stringArray(item.tags);
      if (standards.length && standards.some((standard) => !proposedStandards.includes(standard))) throw new Error(`AI workbook activity ${index + 1} omitted an author-required standards identifier.`);
      return createWorkbookActivity({
        id: `ai-${request.subject}-${stableId(prompt)}-${index + 1}`,
        projectId: request.projectId,
        subject: request.subject,
        gradeBands,
        kind: request.kind,
        difficulty: request.difficulty ?? "practice",
        prompt,
        ...(choices.length ? { choices } : {}),
        ...(answer ? { answer } : {}),
        ...(explanation ? { explanation } : {}),
        standards: proposedStandards.length ? proposedStandards : standards,
        tags: unique([...tags, ...proposedTags]),
        points: integer(item.points, 1),
        enabled: true,
        now,
      });
    });
    return { activities: Object.freeze(activities), ai: evidence(result) };
  }

  rememberEdition(workbook: EducationalWorkbookPlan, now = new Date().toISOString()): MemoryRecord {
    const memoryId = `educational-workbook:${workbook.id}:edition`;
    const existing = this.memory.get(memoryId);
    if (existing) return existing;
    const record = createMemoryRecord({
      id: memoryId,
      projectId: workbook.projectId,
      class: "production-memory",
      authority: "working",
      summary: `Educational workbook edition: ${workbook.title}`,
      content: JSON.stringify({ workbook }),
      provenance: [{ kind: "system", reference: "educational-workbook-office", recordedAt: now }],
      relevanceTags: ["educational-workbook", "workbook", "production", workbook.gradeBand, ...Object.keys(workbook.subjectCounts)],
      now,
    });
    this.memory.register(record);
    return record;
  }
}

function parseObject(text: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(text.trim()); }
  catch { throw new Error(`${label} was not valid JSON.`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object.`);
  return parsed as Record<string, unknown>;
}

function evidence(result: AiGenerationResult): WorkbookAiActivityProposal["ai"] {
  return {
    provider: result.provider,
    model: result.model,
    ...(result.requestId ? { requestId: result.requestId } : {}),
    ...(result.optimization ? { optimization: result.optimization } : {}),
    ...(result.attempts ? { attempts: result.attempts } : {}),
    ...(result.usage ? { usage: result.usage } : {}),
    ...(result.routing ? { routing: result.routing } : {}),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? unique(value.filter((item): item is string => typeof item === "string")) : [];
}
function unique(values: readonly string[]): string[] { return [...new Set(values.map((value) => value.trim()).filter(Boolean))]; }
function required(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function normalize(value: string): string { return value.trim().toLocaleLowerCase().replace(/\s+/g, " "); }
function integer(value: unknown, fallback: number): number { const parsed = Number(value); return Number.isInteger(parsed) ? parsed : fallback; }
function stableId(value: string): string { let hash = 2166136261 >>> 0; for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
