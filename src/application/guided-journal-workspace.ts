import type { JournalCategory, JournalPageStyle, JournalPrompt, GuidedJournalPlan } from "../domain/guided-journal";
import type { JournalInteriorFormat, JournalProductionLayout } from "../domain/guided-journal-layout";
import type { BookCoverPlan, PublishingConfiguration } from "../domain/book-cover-studio";
import type { ProductionArtifact } from "../domain/manuscript-production";
import { GuidedJournalOfficeService } from "./guided-journal-office";
import { GuidedJournalLibraryService } from "./guided-journal-library";
import { GuidedJournalIntelligenceService, type JournalAiCoverDirection, type JournalAiPromptProposal } from "./guided-journal-intelligence";
import { GuidedJournalProductionService } from "./guided-journal-production";

export interface GuidedJournalWorkspaceEditionRequest {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly seed: string;
  readonly promptCount: number;
  readonly categories?: readonly JournalCategory[];
  readonly promptIds?: readonly string[];
  readonly excludedPromptIds?: readonly string[];
  readonly pageStyle?: JournalPageStyle;
  readonly responsePagesPerPrompt?: number;
  readonly includeCoverStatement?: boolean;
  readonly noRepeatAcrossEditions?: boolean;
  readonly now?: string;
}

export interface RandomJournalQuestionRequest {
  readonly projectId: string;
  readonly seed: string;
  readonly category?: JournalCategory;
  readonly excludedPromptIds?: readonly string[];
}

export interface RenderWorkspaceJournalRequest {
  readonly journal: GuidedJournalPlan;
  readonly format: JournalInteriorFormat;
  readonly bookId: string;
  readonly author: string;
  readonly copyrightHolder?: string;
  readonly introduction?: readonly string[];
  readonly closing?: readonly string[];
  readonly now?: string;
}

/** Coherent application facade used by Studio/CLI surfaces for the entire Guided Journal Office. */
export class GuidedJournalWorkspaceService {
  constructor(
    private readonly editions: GuidedJournalOfficeService,
    private readonly library: GuidedJournalLibraryService,
    private readonly intelligence: GuidedJournalIntelligenceService,
    private readonly production: GuidedJournalProductionService,
  ) {}

  async createEdition(request: GuidedJournalWorkspaceEditionRequest): Promise<GuidedJournalPlan> {
    const source = await this.library.get(request.projectId);
    if (!source.prompts.length) throw new Error("Guided Journal prompt library is empty. Add or approve prompts before generating an edition.");
    const journal = await this.editions.createEdition({
      id: request.id,
      projectId: request.projectId,
      title: request.title,
      ...(request.subtitle ? { subtitle: request.subtitle } : {}),
      seed: request.seed,
      promptCount: request.promptCount,
      promptLibrary: source.prompts,
      coverStatements: source.coverStatements,
      pool: {
        ...(request.promptIds?.length ? { promptIds: request.promptIds } : {}),
        ...(request.categories?.length ? { categories: request.categories } : {}),
        ...(request.excludedPromptIds?.length ? { excludedPromptIds: request.excludedPromptIds } : {}),
      },
      ...(request.pageStyle ? { pageStyle: request.pageStyle } : {}),
      ...(request.responsePagesPerPrompt ? { responsePagesPerPrompt: request.responsePagesPerPrompt } : {}),
      ...(request.includeCoverStatement === undefined ? {} : { includeCoverStatement: request.includeCoverStatement }),
      ...(request.noRepeatAcrossEditions === undefined ? {} : { noRepeatAcrossEditions: request.noRepeatAcrossEditions }),
      ...(request.now ? { now: request.now } : {}),
    });
    this.intelligence.rememberEdition(journal, undefined, request.now);
    return journal;
  }

  async randomQuestion(request: RandomJournalQuestionRequest): Promise<JournalPrompt> {
    const source = await this.library.get(request.projectId);
    const excluded = new Set(request.excludedPromptIds ?? []);
    const eligible = source.prompts.filter((prompt) => prompt.enabled && !excluded.has(prompt.id) && (!request.category || prompt.category === request.category));
    if (!eligible.length) throw new Error("No eligible Guided Journal questions remain for this randomizer request.");
    const sorted = [...eligible].sort((a, b) => a.id.localeCompare(b.id));
    const index = seededIndex(request.seed, sorted.length);
    const selected = sorted[index];
    return Object.freeze({ ...selected, tags: Object.freeze([...selected.tags]) });
  }

  async proposePrompts(input: Parameters<GuidedJournalIntelligenceService["proposePrompts"]>[0]): Promise<JournalAiPromptProposal> {
    const source = await this.library.get(input.projectId);
    return this.intelligence.proposePrompts({ ...input, existingPromptTexts: [...source.prompts.map((prompt) => prompt.text), ...(input.existingPromptTexts ?? [])] });
  }

  /** Explicit author-controlled promotion of AI proposals into the usable library. */
  async approvePromptProposal(projectId: string, proposal: JournalAiPromptProposal, now?: string) {
    return this.library.upsertPrompts(projectId, proposal.prompts, now);
  }

  async proposeCoverDirection(input: Parameters<GuidedJournalIntelligenceService["proposeCoverDirection"]>[0]): Promise<JournalAiCoverDirection> {
    return this.intelligence.proposeCoverDirection(input);
  }

  renderPdf(input: RenderWorkspaceJournalRequest): { readonly artifact: ProductionArtifact; readonly layout: JournalProductionLayout } {
    const result = this.production.renderPdf(input);
    this.intelligence.rememberEdition(input.journal, result.layout, input.now);
    return result;
  }

  createCover(input: {
    readonly journal: GuidedJournalPlan;
    readonly layout: JournalProductionLayout;
    readonly bookId: string;
    readonly coverPlanId: string;
    readonly author: string;
    readonly frontPrompt: string;
    readonly backText: string;
    readonly publishing?: Omit<PublishingConfiguration, "pageCount" | "trimWidthInches" | "trimHeightInches">;
    readonly now?: string;
  }): BookCoverPlan {
    return this.intelligence.createCoverPlan(input);
  }

  listEditions(projectId: string) { return this.editions.listEditions(projectId); }
  getEdition(projectId: string, journalId: string) { return this.editions.getEdition(projectId, journalId); }
  getLibrary(projectId: string) { return this.library.get(projectId); }
}

function seededIndex(seed: string, length: number): number {
  if (typeof seed !== "string" || !seed.trim()) throw new Error("Journal randomizer seed is required.");
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { hash ^= seed.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  hash += 0x6d2b79f5;
  let value = hash;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  const random = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  return Math.min(length - 1, Math.floor(random * length));
}
