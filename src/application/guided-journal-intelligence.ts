import { createMemoryRecord, type MemoryRecord } from "../domain/memory";
import type { GuidedJournalPlan, JournalCoverStatement, JournalPrompt } from "../domain/guided-journal";
import { planJournalProductionLayout, type JournalInteriorFormat, type JournalProductionLayout } from "../domain/guided-journal-layout";
import type { PublishingConfiguration, BookCoverPlan } from "../domain/book-cover-studio";
import { BookCoverStudioService } from "./book-cover-studio";
import type { ProjectMemoryStore } from "./project-memory-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";

export interface JournalAiPromptRequest {
  readonly projectId: string;
  readonly category: JournalPrompt["category"];
  readonly count: number;
  readonly purpose?: string;
  readonly audience?: string;
  readonly existingPromptTexts?: readonly string[];
}

export interface JournalAiPromptProposal {
  readonly prompts: readonly JournalPrompt[];
  readonly ai: Pick<AiGenerationResult, "provider" | "model" | "requestId" | "optimization" | "attempts">;
}

export interface JournalAiCoverRequest {
  readonly projectId: string;
  readonly journal: GuidedJournalPlan;
  readonly audience?: string;
  readonly tone?: string;
}

export interface JournalAiCoverDirection {
  readonly frontPrompt: string;
  readonly backText: string;
  readonly coverStatement?: JournalCoverStatement;
  readonly ai: Pick<AiGenerationResult, "provider" | "model" | "requestId" | "optimization" | "attempts">;
}

export interface CreateJournalCoverRequest {
  readonly journal: GuidedJournalPlan;
  readonly layout: JournalProductionLayout;
  readonly bookId: string;
  readonly coverPlanId: string;
  readonly author: string;
  readonly frontPrompt: string;
  readonly backText: string;
  readonly publishing?: Omit<PublishingConfiguration, "pageCount" | "trimWidthInches" | "trimHeightInches">;
  readonly now?: string;
}

export type ProjectAiGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;

/**
 * Shared-trunk integration boundary for the Guided Journal Office.
 * It deliberately consumes the existing Project Brain, provider pool and Cover Studio.
 * No journal-specific AI gateway, memory silo or cover calculator is created here.
 */
export class GuidedJournalIntelligenceService {
  constructor(
    private readonly memory: ProjectMemoryStore,
    private readonly covers: BookCoverStudioService,
    private readonly ai: ProjectAiGenerator = generateProjectText,
  ) {}

  rememberEdition(journal: GuidedJournalPlan, layout?: JournalProductionLayout, now = new Date().toISOString()): MemoryRecord {
    const memoryId = `journal:${journal.id}:edition`;
    const existing = this.memory.get(memoryId);
    if (existing) return existing;
    const record = createMemoryRecord({
      id: memoryId,
      projectId: journal.projectId,
      class: "production-memory",
      authority: "working",
      summary: `Guided journal edition: ${journal.title}`,
      content: JSON.stringify({ journal, ...(layout ? { layout } : {}) }),
      provenance: [{ kind: "system", reference: "guided-journal-office", recordedAt: now }],
      relevanceTags: ["guided-journal", "journal", "production", ...Object.keys(journal.categoryCounts).filter((category) => journal.categoryCounts[category as keyof typeof journal.categoryCounts] > 0)],
      now,
    });
    this.memory.register(record);
    return record;
  }

  createProductionLayout(journal: GuidedJournalPlan, format: JournalInteriorFormat): JournalProductionLayout {
    const layout = planJournalProductionLayout(journal, format);
    this.rememberEdition(journal, layout);
    return layout;
  }

  async proposePrompts(request: JournalAiPromptRequest): Promise<JournalAiPromptProposal> {
    if (!Number.isInteger(request.count) || request.count < 1 || request.count > 100) throw new Error("AI journal prompt count must be an integer from 1 to 100.");
    const existing = [...new Set((request.existingPromptTexts ?? []).map((value) => value.trim()).filter(Boolean))];
    const result = await this.ai({
      memory: this.memory,
      context: {
        projectId: request.projectId,
        taskMemoryClasses: ["author-memory", "project-memory", "style-memory", "research-memory", "decision-memory", "production-memory"],
        relevanceTags: ["guided-journal"],
        queryTerms: [request.category, request.purpose ?? "journal", request.audience ?? "reader"],
        includeWorkingState: true,
        limit: 30,
      },
      system: "You are the Guided Journal Office creative assistant inside Author's Forge. Follow Project Brain context and the author's approved direction. Generate original reflective journal prompts, never claims of fact or therapy. Return only valid JSON.",
      user: [
        `Create exactly ${request.count} original ${request.category} prompts.`,
        request.purpose?.trim() ? `Purpose: ${request.purpose.trim()}` : "",
        request.audience?.trim() ? `Audience: ${request.audience.trim()}` : "",
        existing.length ? `Do not repeat or closely paraphrase these existing prompts: ${JSON.stringify(existing)}` : "",
        `Return JSON shaped exactly as {"prompts":[{"text":"...","tags":["..."]}]}.`,
      ].filter(Boolean).join("\n"),
      temperature: 0.8,
      maxOutputTokens: Math.min(6000, Math.max(800, request.count * 100)),
    });
    const parsed = parseJsonObject(result.text, "AI journal prompt response");
    const raw = Array.isArray(parsed.prompts) ? parsed.prompts : undefined;
    if (!raw || raw.length !== request.count) throw new Error(`AI journal prompt response must contain exactly ${request.count} prompts.`);
    const seen = new Set(existing.map(normalize));
    const prompts = raw.map((item, index) => {
      if (!item || typeof item !== "object") throw new Error("AI journal prompt response contains an invalid prompt.");
      const obj = item as Record<string, unknown>;
      const text = requiredString(obj.text, "AI journal prompt text");
      const normalized = normalize(text);
      if (seen.has(normalized)) throw new Error("AI journal prompt response repeated an existing prompt.");
      seen.add(normalized);
      const tags = Array.isArray(obj.tags) ? [...new Set(obj.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))] : [];
      return Object.freeze({ id: `ai-${request.category}-${stableId(text)}-${index + 1}`, category: request.category, text, tags: Object.freeze(tags), enabled: true });
    });
    return { prompts: Object.freeze(prompts), ai: aiEvidence(result) };
  }

  async proposeCoverDirection(request: JournalAiCoverRequest): Promise<JournalAiCoverDirection> {
    const result = await this.ai({
      memory: this.memory,
      context: {
        projectId: request.projectId,
        taskMemoryClasses: ["author-memory", "project-memory", "style-memory", "visual-identity", "marketing-memory", "research-memory", "decision-memory", "production-memory"],
        relevanceTags: ["guided-journal"],
        queryTerms: [request.journal.title, request.audience ?? "journal", request.tone ?? "reflective"],
        includeWorkingState: true,
        limit: 30,
      },
      system: "You are the Author's Forge Cover Studio creative assistant. Use Project Brain context and preserve author direction. Produce a concise production-useful visual brief and back-cover copy. Return only valid JSON.",
      user: [
        `Journal title: ${request.journal.title}`,
        request.journal.subtitle ? `Subtitle: ${request.journal.subtitle}` : "",
        request.audience?.trim() ? `Audience: ${request.audience.trim()}` : "",
        request.tone?.trim() ? `Tone: ${request.tone.trim()}` : "",
        request.journal.coverStatement ? `Existing cover statement: ${request.journal.coverStatement.text}` : "",
        `Categories represented: ${Object.entries(request.journal.categoryCounts).filter(([, count]) => count > 0).map(([category]) => category).join(", ")}`,
        `Return JSON shaped exactly as {"frontPrompt":"visual art direction","backText":"back cover copy","coverStatement":{"text":"optional short statement","tags":["..."]}}.`,
      ].filter(Boolean).join("\n"),
      temperature: 0.7,
      maxOutputTokens: 1800,
    });
    const parsed = parseJsonObject(result.text, "AI journal cover response");
    const frontPrompt = requiredString(parsed.frontPrompt, "AI journal cover frontPrompt");
    const backText = requiredString(parsed.backText, "AI journal cover backText");
    let coverStatement: JournalCoverStatement | undefined;
    if (parsed.coverStatement && typeof parsed.coverStatement === "object") {
      const obj = parsed.coverStatement as Record<string, unknown>;
      const text = requiredString(obj.text, "AI journal cover statement text");
      const tags = Array.isArray(obj.tags) ? [...new Set(obj.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))] : [];
      coverStatement = Object.freeze({ id: `ai-cover-${stableId(text)}`, text, tags: Object.freeze(tags), enabled: true });
    }
    return { frontPrompt, backText, ...(coverStatement ? { coverStatement } : {}), ai: aiEvidence(result) };
  }

  createCoverPlan(request: CreateJournalCoverRequest): BookCoverPlan {
    if (request.journal.projectId !== request.layout.projectId || request.journal.id !== request.layout.journalId) throw new Error("Journal cover must use the production layout for the same journal edition.");
    const publishing: PublishingConfiguration = {
      platform: "kdp",
      binding: request.publishing?.binding ?? "paperback",
      interiorType: request.publishing?.interiorType ?? "black-white",
      paperType: request.publishing?.paperType ?? "white",
      trimWidthInches: request.layout.format.trimWidthInches,
      trimHeightInches: request.layout.format.trimHeightInches,
      pageCount: request.layout.totalPages,
      bleedInches: request.publishing?.bleedInches ?? 0.125,
      readingDirection: request.publishing?.readingDirection ?? "ltr",
    };
    const plan = this.covers.create({
      id: request.coverPlanId,
      projectId: request.journal.projectId,
      bookId: request.bookId,
      format: publishing.binding,
      publishing,
      title: request.journal.title,
      author: request.author,
      frontPrompt: request.frontPrompt,
      spineText: request.journal.title,
      backText: request.backText,
      outputFormat: "pdf",
      dpi: 300,
      version: 1,
      approvalStatus: "draft",
      ...(request.now ? { now: request.now } : {}),
    });
    const now = request.now ?? new Date().toISOString();
    const memoryId = `journal:${request.journal.id}:cover:${plan.id}`;
    if (!this.memory.get(memoryId)) this.memory.register(createMemoryRecord({
      id: memoryId,
      projectId: request.journal.projectId,
      class: "production-memory",
      authority: "working",
      summary: `Guided journal cover plan: ${request.journal.title}`,
      content: JSON.stringify({ journalId: request.journal.id, layout: request.layout, coverPlan: plan }),
      provenance: [{ kind: "system", reference: "guided-journal-cover-bridge", recordedAt: now }],
      relevanceTags: ["guided-journal", "cover", "production", "kdp"],
      relatedMemoryIds: [`journal:${request.journal.id}:edition`],
      now,
    }));
    return plan;
  }
}

function parseJsonObject(text: string, label: string): Record<string, unknown> {
  const trimmed = text.trim();
  let value: unknown;
  try { value = JSON.parse(trimmed); }
  catch { throw new Error(`${label} was not valid JSON.`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function normalize(value: string): string { return value.trim().toLocaleLowerCase().replace(/\s+/g, " "); }
function stableId(value: string): string {
  let hash = 2166136261 >>> 0;
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}
function aiEvidence(result: AiGenerationResult): Pick<AiGenerationResult, "provider" | "model" | "requestId" | "optimization" | "attempts"> {
  return { provider: result.provider, model: result.model, ...(result.requestId ? { requestId: result.requestId } : {}), ...(result.optimization ? { optimization: result.optimization } : {}), ...(result.attempts ? { attempts: result.attempts } : {}) };
}
