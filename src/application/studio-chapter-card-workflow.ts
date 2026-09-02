import { randomUUID } from "node:crypto";
import type { ProjectState } from "../domain/project";
import { assertAiCollaborationCapability } from "../domain/ai-collaboration";
import {
  approveChapterCard,
  chapterCardApprovalFor,
  createChapterCardCandidateSet,
  createChapterCardWorkflowState,
  reviewChapterCardCandidate,
  upsertChapterCardCandidate,
  validateChapterCardWorkflowState,
  type ChapterCardCandidateChapter,
  type ChapterCardWorkflowState,
} from "../domain/chapter-card-workflow";
import {
  createStoryMapChapterCard,
  createStoryMapPlanningState,
  setStoryMapChapterCard,
  validateStoryMapPlanningState,
  type StoryMapChapterCard,
  type StoryMapPlanningState,
} from "../domain/story-map-planning";
import {
  addWorkspaceChapter,
  addWorkspaceScene,
  getBook,
  validateStudioWorkspace,
  type StudioWorkspaceState,
} from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import { ProjectMemoryStore } from "./project-memory-store";
import type { AiWritingStudioService } from "./ai-writing-studio";

export type ChapterCardPlanGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;

type ChapterCardProject = ProjectState & {
  readonly storyMapPlanning?: StoryMapPlanningState;
  readonly chapterCardWorkflow?: ChapterCardWorkflowState;
};

export interface GenerateChapterCardsInput {
  readonly bookId: string;
  readonly description: string;
  readonly events?: readonly string[];
  readonly timelineDetails?: readonly string[];
  readonly targetChapters?: number;
  readonly replaceExistingCards?: boolean;
  readonly now?: string;
}

export interface DraftApprovedChapterCardsInput {
  readonly bookId: string;
  readonly chapterIds?: readonly string[];
  readonly authorApproved: boolean;
  readonly now?: string;
}

export class StudioChapterCardWorkflowService {
  constructor(
    private readonly projects: Pick<FileProjectStore, "load" | "save">,
    private readonly writing: Pick<AiWritingStudioService, "generateWithProjectContext">,
    private readonly generator: ChapterCardPlanGenerator = generateProjectText,
  ) {}

  async snapshot(projectId: string) {
    const project = await this.requireProject(projectId);
    const planning = planningOf(project);
    const workflow = workflowOf(project);
    const validApprovals = Object.entries(planning.chapterCards).flatMap(([chapterId, card]) => {
      const approval = chapterCardApprovalFor(workflow, chapterId, card);
      return approval ? [{ ...approval, valid: true as const }] : [];
    });
    return Object.freeze({ projectId, workflow, validApprovals });
  }

  async generateChapterCards(projectId: string, input: GenerateChapterCardsInput) {
    const project = await this.requireProject(projectId);
    assertAiCollaborationCapability(project.aiCollaborationPolicy, "draft", "Chapter Card generation", "author-requested");
    let workspace = requireWorkspace(project);
    const book = getBook(workspace, identifier(input.bookId, "Book id"));
    const description = requiredText(input.description, "Book description", 32_000);
    const events = textList(input.events ?? [], "Book event", 100, 2_000);
    const timelineDetails = textList(input.timelineDetails ?? [], "Timeline detail", 100, 2_000);
    const targetChapters = input.targetChapters === undefined ? undefined : positiveInteger(input.targetChapters, "Target chapters", 100);
    const planning = planningOf(project);
    const workflow = workflowOf(project);

    const existingBookCardChapterIds = book.chapters.filter((chapter) => planning.chapterCards[chapter.id]).map((chapter) => chapter.id);
    if (existingBookCardChapterIds.length && input.replaceExistingCards !== true) {
      throw new Error("This book already has Chapter Cards. Review or remove them first, or explicitly choose to replace unapproved cards.");
    }
    if (input.replaceExistingCards === true) {
      for (const chapterId of existingBookCardChapterIds) {
        const card = planning.chapterCards[chapterId];
        if (card && chapterCardApprovalFor(workflow, chapterId, card)) {
          throw new Error(`Approved Chapter Card "${chapterId}" cannot be replaced by generation. Edit it manually or create a new book plan.`);
        }
      }
    }

    const memory = new ProjectMemoryStore();
    for (const record of project.memories) memory.register(record);
    const characters = (project.characters ?? []).map((character) => ({ id: character.id, name: character.profile.name }));
    const result = await this.generator({
      memory,
      context: {
        projectId,
        taskMemoryClasses: ["author-memory", "project-memory", "story-canon", "character-memory", "relationship-memory", "timeline-memory", "location-memory", "style-memory", "decision-memory", "creative-note", "open-thread"],
        includeWorkingState: true,
        limit: 256,
      },
      system: [
        "You are Author's Forge Chapter Card architect.",
        "The author has explicitly asked you to turn a book description, known events, and timeline details into a coherent chapter-by-chapter plan.",
        "Return ONLY valid JSON matching the requested schema. Do not wrap it in commentary.",
        "Preserve supplied canon and timeline constraints. Do not invent research or present guesses as facts.",
        "Use only supplied character ids when assigning POV or characters present. If no supplied id is appropriate, leave those arrays empty.",
        "Each chapter must advance the book, preserve continuity with prior chapters, and end with a useful transition or hook where appropriate.",
      ].join(" "),
      user: [
        `BOOK: ${book.title}`,
        `BOOK KIND: ${book.kind}`,
        book.description ? `EXISTING BOOK DESCRIPTION:\n${book.description}` : "",
        `AUTHOR DESCRIPTION:\n${description}`,
        events.length ? `KNOWN EVENTS:\n${events.map((item) => `- ${item}`).join("\n")}` : "KNOWN EVENTS: none supplied beyond the description.",
        timelineDetails.length ? `TIMELINE DETAILS:\n${timelineDetails.map((item) => `- ${item}`).join("\n")}` : "TIMELINE DETAILS: none supplied beyond the description.",
        characters.length ? `AVAILABLE CHARACTER IDS:\n${characters.map((item) => `- ${item.id}: ${item.name}`).join("\n")}` : "AVAILABLE CHARACTER IDS: none yet.",
        `TARGET CHAPTER COUNT: ${targetChapters ?? "Choose an appropriate count between 8 and 40 unless the book clearly requires fewer."}`,
        "JSON SCHEMA:",
        '{"chapters":[{"number":1,"title":"Chapter title","povCharacterIds":[],"location":"","storyTime":"","emotionalObjective":"","plotObjective":"","characterIds":[],"requiredEvents":[],"clues":[],"reveals":[],"continuityDependencies":[],"atmosphere":"","endingHook":"","approximateWordCount":0,"forbiddenDeviations":[]}]}'
      ].filter(Boolean).join("\n\n"),
      task: "writing",
      requiresCreativeWriting: true,
      requiresInstructionFollowing: true,
      temperature: 0.35,
      maxOutputTokens: 16_000,
    });

    const parsed = parseJsonObject(result.text);
    const rawChapters = parsed.chapters;
    if (!Array.isArray(rawChapters) || rawChapters.length === 0) throw new Error("AI Chapter Card plan did not contain a chapter collection.");
    if (rawChapters.length > 100) throw new Error("AI Chapter Card plan exceeds the 100-chapter generation limit.");
    if (targetChapters !== undefined && rawChapters.length !== targetChapters) {
      throw new Error(`AI returned ${rawChapters.length} chapters but the author requested ${targetChapters}. No planning changes were saved.`);
    }

    const chapterIds = new Set((project.characters ?? []).map((character) => character.id));
    const candidateChapters = rawChapters.map((raw, index) => parseCandidateChapter(raw, index + 1, chapterIds));
    const numbers = new Set<number>();
    for (const chapter of candidateChapters) {
      if (numbers.has(chapter.number)) throw new Error(`AI Chapter Card plan contains duplicate chapter number ${chapter.number}.`);
      numbers.add(chapter.number);
    }
    candidateChapters.sort((a, b) => a.number - b.number);
    const expected = targetChapters ?? candidateChapters.length;
    if (candidateChapters.length !== expected) throw new Error("AI Chapter Card plan count is inconsistent.");

    let nextPlanning = planning;
    const mapped: Array<{ number: number; chapterId: string; title: string }> = [];
    for (const candidate of candidateChapters) {
      let currentBook = getBook(workspace, book.id);
      let chapter = currentBook.chapters.find((item) => item.number === candidate.number);
      if (!chapter) {
        const chapterId = `chapter-${randomUUID()}`;
        workspace = addWorkspaceChapter(workspace, book.id, { id: chapterId, number: candidate.number, title: candidate.title, synopsis: candidate.card.plotObjective, now: input.now });
        currentBook = getBook(workspace, book.id);
        chapter = currentBook.chapters.find((item) => item.id === chapterId);
      }
      if (!chapter) throw new Error(`Unable to create Chapter ${candidate.number}.`);
      const existing = nextPlanning.chapterCards[chapter.id];
      if (existing && input.replaceExistingCards !== true) throw new Error(`Chapter ${chapter.number} already has a Chapter Card.`);
      nextPlanning = setStoryMapChapterCard(nextPlanning, chapter.id, candidate.card);
      mapped.push({ number: candidate.number, chapterId: chapter.id, title: chapter.title });
    }

    const candidate = createChapterCardCandidateSet({
      id: `chapter-card-plan-${randomUUID()}`,
      projectId,
      bookId: book.id,
      description,
      events,
      timelineDetails,
      targetChapters: candidateChapters.length,
      chapters: candidateChapters,
      provider: result.provider,
      model: result.model,
      now: input.now,
    });
    const nextWorkflow = upsertChapterCardCandidate(workflow, candidate);
    await this.save(project, { workspace, planning: nextPlanning, workflow: nextWorkflow, now: input.now });
    return Object.freeze({
      candidate,
      mappedChapters: mapped,
      authorApprovalRequired: true as const,
      manuscriptChanged: false as const,
      message: "AI Chapter Cards were saved as unapproved planning. Review/edit them, then approve before AI drafting.",
    });
  }

  async approveCandidate(projectId: string, candidateId: string, input: { authorApproved: boolean; now?: string }) {
    if (input.authorApproved !== true) throw new Error("Explicit author approval is required before approving generated Chapter Cards.");
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const planning = planningOf(project);
    let workflow = workflowOf(project);
    const candidate = workflow.candidates.find((item) => item.id === identifier(candidateId, "Chapter Card candidate id"));
    if (!candidate) throw new Error(`Chapter Card candidate "${candidateId}" not found.`);
    if (candidate.status !== "pending") throw new Error(`Chapter Card candidate "${candidate.id}" has already been ${candidate.status}.`);
    const book = getBook(workspace, candidate.bookId);

    for (const proposed of candidate.chapters) {
      const chapter = book.chapters.find((item) => item.number === proposed.number);
      if (!chapter) throw new Error(`Generated Chapter ${proposed.number} no longer exists in the book.`);
      const currentCard = planning.chapterCards[chapter.id];
      if (!currentCard) throw new Error(`Chapter ${chapter.number} no longer has a Chapter Card to approve.`);
      validateCardCharacterReferences(project, currentCard);
      workflow = approveChapterCard(workflow, chapter.id, currentCard, { now: input.now, sourceCandidateId: candidate.id });
    }
    workflow = reviewChapterCardCandidate(workflow, candidate.id, "approved", input.now);
    await this.save(project, { workspace, planning, workflow, now: input.now });
    return this.snapshot(projectId);
  }

  async rejectCandidate(projectId: string, candidateId: string, input: { now?: string } = {}) {
    const project = await this.requireProject(projectId);
    const workflow = reviewChapterCardCandidate(workflowOf(project), identifier(candidateId, "Chapter Card candidate id"), "rejected", input.now);
    await this.save(project, { workspace: requireWorkspace(project), planning: planningOf(project), workflow, now: input.now });
    return this.snapshot(projectId);
  }

  async approveCard(projectId: string, input: { bookId: string; chapterId: string; authorApproved: boolean; now?: string }) {
    if (input.authorApproved !== true) throw new Error("Explicit author approval is required before a Chapter Card can govern AI drafting.");
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const book = getBook(workspace, identifier(input.bookId, "Book id"));
    const chapterId = identifier(input.chapterId, "Chapter id");
    if (!book.chapters.some((item) => item.id === chapterId)) throw new Error(`Chapter "${chapterId}" not found in book "${book.id}".`);
    const planning = planningOf(project);
    const card = planning.chapterCards[chapterId];
    if (!card) throw new Error(`Chapter "${chapterId}" has no Chapter Card to approve.`);
    validateCardCharacterReferences(project, card);
    const workflow = approveChapterCard(workflowOf(project), chapterId, card, { now: input.now });
    await this.save(project, { workspace, planning, workflow, now: input.now });
    return this.snapshot(projectId);
  }

  async draftApprovedBook(projectId: string, input: DraftApprovedChapterCardsInput) {
    if (input.authorApproved !== true) throw new Error("Explicit author approval is required before AI drafts from approved Chapter Cards.");
    const project = await this.requireProject(projectId);
    assertAiCollaborationCapability(project.aiCollaborationPolicy, "bulk-work", "book drafting from approved Chapter Cards", "author-requested");
    let workspace = requireWorkspace(project);
    let book = getBook(workspace, identifier(input.bookId, "Book id"));
    const planning = planningOf(project);
    const workflow = workflowOf(project);
    const requestedIds = input.chapterIds === undefined ? undefined : new Set(input.chapterIds.map((id) => identifier(id, "Chapter id")));
    const chapters = book.chapters.filter((chapter) => requestedIds === undefined || requestedIds.has(chapter.id));
    if (!chapters.length) throw new Error("No chapters were selected for AI drafting.");
    if (requestedIds && chapters.length !== requestedIds.size) throw new Error("One or more selected chapters do not belong to this book.");

    const unapproved: string[] = [];
    for (const chapter of chapters) {
      const card = planning.chapterCards[chapter.id];
      if (!card || !chapterCardApprovalFor(workflow, chapter.id, card)) unapproved.push(`Chapter ${chapter.number}: ${chapter.title}`);
    }
    if (unapproved.length) throw new Error(`AI drafting requires approved current Chapter Cards. Approval is missing or stale for: ${unapproved.join("; ")}`);

    const skippedExisting: Array<{ chapterId: string; reason: string }> = [];
    const targets: Array<{ chapterId: string; sceneId: string }> = [];
    for (const chapter of chapters) {
      if (chapter.scenes.some((scene) => scene.content.trim())) {
        skippedExisting.push({ chapterId: chapter.id, reason: "Existing manuscript prose was preserved." });
        continue;
      }
      let scene = chapter.scenes[0];
      if (!scene) {
        const sceneId = `scene-${randomUUID()}`;
        const card = planning.chapterCards[chapter.id];
        workspace = addWorkspaceScene(workspace, book.id, chapter.id, { id: sceneId, number: 1, title: "Chapter Draft", synopsis: card?.plotObjective ?? "", now: input.now });
        book = getBook(workspace, book.id);
        scene = book.chapters.find((item) => item.id === chapter.id)?.scenes.find((item) => item.id === sceneId);
      }
      if (!scene) throw new Error(`Unable to prepare a draft scene for Chapter ${chapter.number}.`);
      targets.push({ chapterId: chapter.id, sceneId: scene.id });
    }

    if (targets.length) await this.save(project, { workspace, planning, workflow, now: input.now });

    const generated: Array<{ chapterId: string; sceneId: string; proposalId: string }> = [];
    const failures: Array<{ chapterId: string; error: string }> = [];
    const refreshedBook = getBook(workspace, book.id);
    for (const target of targets) {
      const chapter = refreshedBook.chapters.find((item) => item.id === target.chapterId);
      const scene = chapter?.scenes.find((item) => item.id === target.sceneId);
      const card = planning.chapterCards[target.chapterId];
      if (!chapter || !scene || !card) continue;
      try {
        const proposalId = `chapter-draft-${randomUUID()}`;
        await this.writing.generateWithProjectContext({
          projectId,
          bookId: book.id,
          chapterId: chapter.id,
          sceneId: scene.id,
          task: "draft",
          instruction: [
            `Draft the complete prose for Chapter ${chapter.number}, "${chapter.title}", from the explicitly approved Chapter Card.`,
            card.approximateWordCount ? `Aim for approximately ${card.approximateWordCount} words unless natural pacing requires a modest variation.` : "Use an appropriate chapter length for the book and the card.",
            "Honor every required event, continuity dependency, timeline constraint, POV assignment, reveal boundary, and forbidden deviation.",
            "Return manuscript prose only as an author-reviewable draft proposal; do not claim the draft is canon.",
          ].join(" "),
          existingContent: scene.content,
          proposalId,
          now: input.now,
          context: { query: `${chapter.title} ${card.plotObjective} ${card.emotionalObjective}`.trim() },
        });
        generated.push({ chapterId: chapter.id, sceneId: scene.id, proposalId });
      } catch (error) {
        failures.push({ chapterId: chapter.id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return Object.freeze({
      projectId,
      bookId: book.id,
      generated,
      skippedExisting,
      failures,
      authorReviewRequired: true as const,
      manuscriptProseChanged: false as const,
      message: generated.length
        ? `${generated.length} chapter draft proposal(s) are ready for author review. Existing prose was never overwritten.`
        : "No new chapter draft proposals were created.",
    });
  }

  private async requireProject(projectId: string): Promise<ChapterCardProject> {
    const id = identifier(projectId, "Project id");
    const project = await this.projects.load(id);
    if (!project) throw new Error(`Project "${id}" not found.`);
    return project as ChapterCardProject;
  }

  private async save(project: ChapterCardProject, input: { workspace: StudioWorkspaceState; planning: StoryMapPlanningState; workflow: ChapterCardWorkflowState; now?: string }): Promise<void> {
    const now = timestamp(input.now ?? new Date().toISOString(), "Chapter Card workflow timestamp");
    await this.projects.save({
      ...project,
      studioWorkspace: validateStudioWorkspace(JSON.parse(JSON.stringify(input.workspace))),
      storyMapPlanning: validateStoryMapPlanningState(JSON.parse(JSON.stringify(input.planning))),
      chapterCardWorkflow: validateChapterCardWorkflowState(JSON.parse(JSON.stringify(input.workflow))),
      metadata: { ...project.metadata, updatedAt: now },
    } as ProjectState);
  }
}

function planningOf(project: ChapterCardProject): StoryMapPlanningState {
  return project.storyMapPlanning ? validateStoryMapPlanningState(project.storyMapPlanning) : createStoryMapPlanningState();
}
function workflowOf(project: ChapterCardProject): ChapterCardWorkflowState {
  return project.chapterCardWorkflow ? validateChapterCardWorkflowState(project.chapterCardWorkflow) : createChapterCardWorkflowState();
}
function requireWorkspace(project: ChapterCardProject): StudioWorkspaceState {
  if (!project.studioWorkspace) throw new Error(`Project "${project.metadata.id}" has no Studio workspace. Create or select a book first.`);
  return validateStudioWorkspace(project.studioWorkspace);
}
function parseCandidateChapter(value: unknown, fallbackNumber: number, characterIds: ReadonlySet<string>): ChapterCardCandidateChapter {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI returned an invalid Chapter Card chapter object.");
  const input = value as Record<string, unknown>;
  const number = input.number === undefined ? fallbackNumber : positiveInteger(Number(input.number), "Chapter number", 100);
  const title = requiredText(input.title, "Chapter title", 500);
  const card = createStoryMapChapterCard({
    povCharacterIds: idList(input.povCharacterIds, "POV character id", characterIds),
    location: optionalText(input.location),
    storyTime: optionalText(input.storyTime),
    emotionalObjective: optionalText(input.emotionalObjective),
    plotObjective: optionalText(input.plotObjective),
    characterIds: idList(input.characterIds, "Character id", characterIds),
    requiredEvents: outputTextList(input.requiredEvents, "Required event"),
    clues: outputTextList(input.clues, "Clue"),
    reveals: outputTextList(input.reveals, "Reveal"),
    continuityDependencies: outputTextList(input.continuityDependencies, "Continuity dependency"),
    atmosphere: optionalText(input.atmosphere),
    endingHook: optionalText(input.endingHook),
    approximateWordCount: input.approximateWordCount === undefined ? 0 : nonNegativeInteger(Number(input.approximateWordCount), "Approximate word count", 100_000),
    forbiddenDeviations: outputTextList(input.forbiddenDeviations, "Forbidden deviation"),
  });
  return { number, title, card };
}
function validateCardCharacterReferences(project: ChapterCardProject, card: StoryMapChapterCard): void {
  const ids = new Set((project.characters ?? []).map((character) => character.id));
  for (const id of [...card.povCharacterIds, ...card.characterIds]) if (!ids.has(id)) throw new Error(`Chapter Card references missing character "${id}".`);
}
function idList(value: unknown, label: string, allowed: ReadonlySet<string>): readonly string[] {
  const values = value === undefined ? [] : outputTextList(value, label, 50, 300);
  for (const id of values) if (!allowed.has(id)) throw new Error(`AI Chapter Card referenced unknown ${label.toLowerCase()} "${id}".`);
  return values;
}
function parseJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1] ?? text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI did not return the required Chapter Card JSON object.");
  const value = JSON.parse(fenced.slice(start, end + 1));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI Chapter Card response must be a JSON object.");
  return value as Record<string, unknown>;
}
function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 300 || /[\r\n]/u.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}
function optionalText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function textList(value: readonly string[], label: string, maxItems: number, maxLength: number): readonly string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label} collection is invalid or too large.`);
  const result = value.map((item) => requiredText(item, label, maxLength));
  if (new Set(result).size !== result.length) throw new Error(`${label} collection contains duplicates.`);
  return result;
}
function outputTextList(value: unknown, label: string, maxItems = 40, maxLength = 1_000): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`AI ${label.toLowerCase()} collection is invalid or too large.`);
  const result = value.map((item) => requiredText(item, label, maxLength));
  return [...new Set(result)];
}
function positiveInteger(value: number, label: string, max: number): number {
  if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`${label} must be an integer from 1 through ${max}.`);
  return value;
}
function nonNegativeInteger(value: number, label: string, max: number): number {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(`${label} must be an integer from 0 through ${max}.`);
  return value;
}
function timestamp(value: string, label: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return new Date(value).toISOString();
}
