import type { ProjectState } from "../domain/project";
import { chapterCardApprovalFor, chapterCardSha256, type ChapterCardWorkflowState } from "../domain/chapter-card-workflow";
import {
  createSceneCardDetails,
  createSceneCardWorkflowState,
  approveSceneCard,
  removeSceneCardDetails,
  revokeSceneCardApproval,
  sceneCardApprovalFor,
  sceneCardSha256,
  setSceneCardDetails,
  validateSceneCardWorkflowState,
  type SceneCardDetails,
  type SceneCardSnapshot,
  type SceneCardWorkflowState,
} from "../domain/scene-card-workflow";
import { createStoryMapPlanningState, validateStoryMapPlanningState, type StoryMapPlanningState } from "../domain/story-map-planning";
import { validateStudioWorkspace, type StudioWorkspaceState, type WorkspaceBook, type WorkspaceChapter, type WorkspaceScene } from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";

export type SceneCardProject = ProjectState & {
  readonly storyMapPlanning?: StoryMapPlanningState;
  readonly chapterCardWorkflow?: ChapterCardWorkflowState;
  readonly sceneCardWorkflow?: SceneCardWorkflowState;
};

export interface SceneCardView {
  readonly bookId: string;
  readonly chapterId: string;
  readonly sceneId: string;
  readonly sceneNumber: number;
  readonly sceneTitle: string;
  readonly sceneSynopsis: string;
  readonly sceneHasContent: boolean;
  readonly details: SceneCardDetails;
  readonly attributes: SceneCardSnapshot["attributes"];
  readonly plotlineIds: readonly string[];
  readonly plotlineNames: readonly string[];
  readonly cardSha256: string;
  readonly approved: boolean;
  readonly approvalStale: boolean;
  readonly approvedAt?: string;
}

export interface SceneCardWorkflowSnapshot {
  readonly projectId: string;
  readonly workflow: SceneCardWorkflowState;
  readonly cards: readonly SceneCardView[];
}

export class StudioSceneCardWorkflowService {
  constructor(private readonly projects: Pick<FileProjectStore, "load" | "save">) {}

  async snapshot(projectId: string): Promise<SceneCardWorkflowSnapshot> {
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const planning = planningOf(project);
    const workflow = workflowOf(project);
    const cards: SceneCardView[] = [];
    for (const book of workspace.books) for (const chapter of book.chapters) for (const scene of chapter.scenes) {
      requireUnambiguousSceneId(workspace, scene.id);
      cards.push(viewFor(project, planning, workflow, book, chapter, scene));
    }
    return Object.freeze({ projectId: project.metadata.id, workflow, cards });
  }

  async saveCard(projectId: string, input: {
    bookId: string;
    chapterId: string;
    sceneId: string;
    details: Partial<SceneCardDetails>;
    now?: string;
  }): Promise<SceneCardWorkflowSnapshot> {
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const { scene } = target(workspace, input.bookId, input.chapterId, input.sceneId);
    requireUnambiguousSceneId(workspace, scene.id);
    const details = createSceneCardDetails(input.details);
    validateCharacterIds(project, details.characterIds);
    const workflow = setSceneCardDetails(workflowOf(project), scene.id, details);
    await this.save(project, workflow, input.now);
    return this.snapshot(projectId);
  }

  async removeCard(projectId: string, input: { bookId: string; chapterId: string; sceneId: string; now?: string }): Promise<SceneCardWorkflowSnapshot> {
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const { scene } = target(workspace, input.bookId, input.chapterId, input.sceneId);
    requireUnambiguousSceneId(workspace, scene.id);
    const workflow = workflowOf(project);
    if (!workflow.cards[scene.id]) throw new Error(`Scene Card for scene "${scene.id}" not found.`);
    await this.save(project, removeSceneCardDetails(workflow, scene.id), input.now);
    return this.snapshot(projectId);
  }

  async approveCard(projectId: string, input: {
    bookId: string;
    chapterId: string;
    sceneId: string;
    authorApproved: boolean;
    now?: string;
  }): Promise<SceneCardWorkflowSnapshot> {
    if (input.authorApproved !== true) throw new Error("Explicit author approval is required before a Scene Card can govern AI drafting.");
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const planning = planningOf(project);
    const workflow = workflowOf(project);
    const { book, chapter, scene } = target(workspace, input.bookId, input.chapterId, input.sceneId);
    requireUnambiguousSceneId(workspace, scene.id);
    const details = workflow.cards[scene.id];
    if (!details) throw new Error(`Scene "${scene.id}" has no Scene Card details to approve.`);
    validateCharacterIds(project, details.characterIds);
    if (!hasMeaningfulPlan(planning.sceneAttributes[scene.id], details)) {
      throw new Error("Scene Card needs a purpose, scene goal, or required event before approval.");
    }
    requireApprovedChapterCardWhenPresent(project, planning, chapter.id);
    const snapshot = cardSnapshot(project, planning, details, book, chapter, scene);
    await this.save(project, approveSceneCard(workflow, snapshot, input.now), input.now);
    return this.snapshot(projectId);
  }

  async revokeApproval(projectId: string, input: { bookId: string; chapterId: string; sceneId: string; now?: string }): Promise<SceneCardWorkflowSnapshot> {
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const { scene } = target(workspace, input.bookId, input.chapterId, input.sceneId);
    requireUnambiguousSceneId(workspace, scene.id);
    const workflow = workflowOf(project);
    if (!workflow.approvals.some((item) => item.sceneId === scene.id)) throw new Error(`Scene Card for scene "${scene.id}" has no approval to revoke.`);
    await this.save(project, revokeSceneCardApproval(workflow, scene.id), input.now);
    return this.snapshot(projectId);
  }

  async draftBrief(projectId: string, input: { bookId: string; chapterId: string; sceneId: string }) {
    const project = await this.requireProject(projectId);
    const workspace = requireWorkspace(project);
    const planning = planningOf(project);
    const workflow = workflowOf(project);
    const { book, chapter, scene } = target(workspace, input.bookId, input.chapterId, input.sceneId);
    requireUnambiguousSceneId(workspace, scene.id);
    const details = workflow.cards[scene.id];
    if (!details) throw new Error(`Scene "${scene.id}" has no Scene Card.`);
    validateCharacterIds(project, details.characterIds);
    requireApprovedChapterCardWhenPresent(project, planning, chapter.id);
    const snapshot = cardSnapshot(project, planning, details, book, chapter, scene);
    const approval = sceneCardApprovalFor(workflow, snapshot);
    if (!approval) throw new Error("Scene Card is not currently author-approved. Save the latest planning and approve this exact version before AI drafting.");
    if (scene.content.trim()) {
      throw new Error("This scene already contains manuscript text. Scene Card auto-drafting is intentionally limited to empty scenes so it cannot overwrite author work; use the normal Writing Desk for revisions or continuation.");
    }
    const plotlines = planning.plotlines.filter((item) => item.bookId === book.id && item.sceneIds.includes(scene.id));
    const characterIds = uniqueStrings([...(snapshot.attributes.povCharacterIds ?? []), ...details.characterIds]);
    return Object.freeze({
      bookId: book.id,
      chapterId: chapter.id,
      sceneId: scene.id,
      task: "draft" as const,
      cardSha256: approval.cardSha256,
      characterIds,
      instruction: buildDraftInstruction(book, chapter, scene, snapshot, plotlines.map((item) => item.name)),
      authorApprovalRequiredAfterGeneration: true as const,
      manuscriptChanged: false as const,
    });
  }

  private async requireProject(projectId: string): Promise<SceneCardProject> {
    const id = identifier(projectId, "Project id");
    const project = await this.projects.load(id);
    if (!project) throw new Error(`Project "${id}" not found.`);
    return project as SceneCardProject;
  }

  private async save(project: SceneCardProject, workflow: SceneCardWorkflowState, now = new Date().toISOString()): Promise<void> {
    await this.projects.save({
      ...project,
      sceneCardWorkflow: validateSceneCardWorkflowState(JSON.parse(JSON.stringify(workflow))),
      metadata: { ...project.metadata, updatedAt: timestamp(now, "Scene Card workflow timestamp") },
    } as ProjectState);
  }
}

function viewFor(
  project: SceneCardProject,
  planning: StoryMapPlanningState,
  workflow: SceneCardWorkflowState,
  book: WorkspaceBook,
  chapter: WorkspaceChapter,
  scene: WorkspaceScene,
): SceneCardView {
  const details = workflow.cards[scene.id] ?? createSceneCardDetails();
  validateCharacterIds(project, details.characterIds);
  const snapshot = cardSnapshot(project, planning, details, book, chapter, scene);
  const approval = sceneCardApprovalFor(workflow, snapshot);
  const historicalApproval = workflow.approvals.find((item) => item.sceneId === scene.id);
  const plotlines = planning.plotlines.filter((item) => item.bookId === book.id && item.sceneIds.includes(scene.id));
  return {
    bookId: book.id,
    chapterId: chapter.id,
    sceneId: scene.id,
    sceneNumber: scene.number,
    sceneTitle: scene.title,
    sceneSynopsis: scene.synopsis,
    sceneHasContent: Boolean(scene.content.trim()),
    details,
    attributes: snapshot.attributes,
    plotlineIds: snapshot.plotlineIds,
    plotlineNames: plotlines.map((item) => item.name),
    cardSha256: sceneCardSha256(snapshot),
    approved: Boolean(approval),
    approvalStale: Boolean(historicalApproval && !approval),
    ...(approval ? { approvedAt: approval.approvedAt } : {}),
  };
}

function cardSnapshot(
  project: SceneCardProject,
  planning: StoryMapPlanningState,
  details: SceneCardDetails,
  book: WorkspaceBook,
  chapter: WorkspaceChapter,
  scene: WorkspaceScene,
): SceneCardSnapshot {
  const attributes = planning.sceneAttributes[scene.id] ?? {
    povCharacterIds: [], location: "", storyTime: "", goal: "", conflict: "", outcome: "", emotionalBeat: "", tags: [],
  };
  const plotlineIds = planning.plotlines.filter((item) => item.bookId === book.id && item.sceneIds.includes(scene.id)).map((item) => item.id).sort();
  const chapterCard = planning.chapterCards[chapter.id];
  const approvedChapterCard = chapterCard ? chapterCardApprovalFor(project.chapterCardWorkflow, chapter.id, chapterCard) : undefined;
  return {
    bookId: book.id,
    chapterId: chapter.id,
    ...(chapterCard && approvedChapterCard ? { chapterCardSha256: chapterCardSha256(chapterCard) } : {}),
    sceneId: scene.id,
    sceneNumber: scene.number,
    sceneTitle: scene.title,
    sceneSynopsis: scene.synopsis,
    attributes,
    plotlineIds,
    details,
  };
}

function buildDraftInstruction(
  book: WorkspaceBook,
  chapter: WorkspaceChapter,
  scene: WorkspaceScene,
  snapshot: SceneCardSnapshot,
  plotlineNames: readonly string[],
): string {
  const { attributes, details } = snapshot;
  const list = (label: string, values: readonly string[]) => values.length ? `${label}:\n${values.map((item) => `- ${item}`).join("\n")}` : `${label}: none specified`;
  return [
    "Draft this scene from the author-approved Scene Card below. Treat every supplied constraint as author direction, not as a suggestion.",
    `BOOK: ${book.title}`,
    `CHAPTER ${chapter.number}: ${chapter.title}`,
    `SCENE ${scene.number}: ${scene.title}`,
    scene.synopsis ? `SCENE SYNOPSIS: ${scene.synopsis}` : "",
    details.purpose ? `PURPOSE: ${details.purpose}` : "",
    attributes.goal ? `GOAL: ${attributes.goal}` : "",
    attributes.conflict ? `CONFLICT: ${attributes.conflict}` : "",
    attributes.outcome ? `OUTCOME: ${attributes.outcome}` : "",
    attributes.emotionalBeat ? `EMOTIONAL BEAT: ${attributes.emotionalBeat}` : "",
    attributes.location ? `LOCATION: ${attributes.location}` : "",
    attributes.storyTime ? `STORY TIME: ${attributes.storyTime}` : "",
    details.openingSituation ? `OPENING SITUATION: ${details.openingSituation}` : "",
    details.closingSituation ? `CLOSING SITUATION: ${details.closingSituation}` : "",
    details.atmosphere ? `ATMOSPHERE: ${details.atmosphere}` : "",
    details.approximateWordCount ? `TARGET LENGTH: approximately ${details.approximateWordCount} words` : "",
    list("REQUIRED EVENTS", details.requiredEvents),
    list("CLUES", details.clues),
    list("REVEALS", details.reveals),
    list("CONTINUITY DEPENDENCIES", details.continuityDependencies),
    list("FORBIDDEN DEVIATIONS", details.forbiddenDeviations),
    list("PLOTLINES", plotlineNames),
    details.notes ? `AUTHOR NOTES: ${details.notes}` : "",
    "Do not add major events, reveals, relationships, injuries, locations, timeline changes, or canon beyond what the approved plan and governed project context support. Produce scene prose only. The result must remain a proposal until the author separately approves and applies it.",
  ].filter(Boolean).join("\n\n");
}

function requireApprovedChapterCardWhenPresent(project: SceneCardProject, planning: StoryMapPlanningState, chapterId: string): void {
  const chapterCard = planning.chapterCards[chapterId];
  if (!chapterCard) return;
  if (!chapterCardApprovalFor(project.chapterCardWorkflow, chapterId, chapterCard)) {
    throw new Error("This chapter has a Chapter Card, but its current version is not author-approved. Approve the Chapter Card before approving or drafting from Scene Cards in this chapter.");
  }
}

function hasMeaningfulPlan(attributes: SceneCardSnapshot["attributes"] | undefined, details: SceneCardDetails): boolean {
  return Boolean(details.purpose.trim() || attributes?.goal.trim() || details.requiredEvents.length);
}
function planningOf(project: SceneCardProject): StoryMapPlanningState {
  return project.storyMapPlanning ? validateStoryMapPlanningState(project.storyMapPlanning) : createStoryMapPlanningState();
}
function workflowOf(project: SceneCardProject): SceneCardWorkflowState {
  return project.sceneCardWorkflow ? validateSceneCardWorkflowState(project.sceneCardWorkflow) : createSceneCardWorkflowState();
}
function requireWorkspace(project: SceneCardProject): StudioWorkspaceState {
  if (!project.studioWorkspace) throw new Error(`Project "${project.metadata.id}" has no Studio workspace.`);
  return validateStudioWorkspace(project.studioWorkspace);
}
function target(workspace: StudioWorkspaceState, bookId: string, chapterId: string, sceneId: string): { book: WorkspaceBook; chapter: WorkspaceChapter; scene: WorkspaceScene } {
  const book = workspace.books.find((item) => item.id === identifier(bookId, "Book id"));
  if (!book) throw new Error(`Book "${bookId}" not found.`);
  const chapter = book.chapters.find((item) => item.id === identifier(chapterId, "Chapter id"));
  if (!chapter) throw new Error(`Chapter "${chapterId}" not found in book "${book.id}".`);
  const scene = chapter.scenes.find((item) => item.id === identifier(sceneId, "Scene id"));
  if (!scene) throw new Error(`Scene "${sceneId}" not found in chapter "${chapter.id}".`);
  return { book, chapter, scene };
}
function requireUnambiguousSceneId(workspace: StudioWorkspaceState, sceneId: string): void {
  const count = workspace.books.reduce((total, book) => total + book.chapters.reduce((chapterTotal, chapter) => chapterTotal + chapter.scenes.filter((scene) => scene.id === sceneId).length, 0), 0);
  if (count !== 1) throw new Error(`Scene id "${sceneId}" must be globally unique before it can have an authoritative Scene Card.`);
}
function validateCharacterIds(project: SceneCardProject, ids: readonly string[]): void {
  const available = new Set((project.characters ?? []).map((character) => character.id));
  for (const id of ids) if (!available.has(id)) throw new Error(`Scene Card character "${id}" not found.`);
}
function uniqueStrings(values: readonly string[]): readonly string[] { return [...new Set(values.filter(Boolean))]; }
function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > 300 || /[\r\n]/u.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}
function timestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} is invalid.`);
  return new Date(value).toISOString();
}
