import { chapterCardApprovalFor, chapterCardSha256, type ChapterCardWorkflowState } from "../domain/chapter-card-workflow";
import { createSceneCardWorkflowState, sceneCardApprovalFor, validateSceneCardWorkflowState, type SceneCardSnapshot, type SceneCardWorkflowState } from "../domain/scene-card-workflow";
import { createStoryMapPlanningState, validateStoryMapPlanningState, type StoryMapPlanningState } from "../domain/story-map-planning";
import type { StudioWorkspaceState } from "../domain/studio-workspace";

export interface SceneCardGenerationProjectState {
  readonly storyMapPlanning?: StoryMapPlanningState;
  readonly chapterCardWorkflow?: ChapterCardWorkflowState;
  readonly sceneCardWorkflow?: SceneCardWorkflowState;
}

/**
 * Revalidates the exact author-approved Scene Card immediately before provider
 * execution. A draft brief is therefore not a bearer token: if the approved
 * Chapter Card above it, live scene metadata, Story Map planning, plotline
 * membership, or Scene Card details changed since the brief was issued,
 * generation fails before the provider is called.
 */
export function assertApprovedSceneCardGeneration(
  project: SceneCardGenerationProjectState,
  workspace: StudioWorkspaceState,
  input: { bookId: string; chapterId: string; sceneId: string; expectedCardSha256: string },
): SceneCardSnapshot {
  if (!/^[a-f0-9]{64}$/u.test(input.expectedCardSha256)) throw new Error("Scene Card generation binding hash is invalid.");
  const book = workspace.books.find((item) => item.id === input.bookId);
  if (!book) throw new Error(`Scene Card generation book "${input.bookId}" not found.`);
  const chapter = book.chapters.find((item) => item.id === input.chapterId);
  if (!chapter) throw new Error(`Scene Card generation chapter "${input.chapterId}" not found.`);
  const scene = chapter.scenes.find((item) => item.id === input.sceneId);
  if (!scene) throw new Error(`Scene Card generation scene "${input.sceneId}" not found.`);

  const sceneMatches = workspace.books.reduce(
    (total, candidateBook) => total + candidateBook.chapters.reduce(
      (chapterTotal, candidateChapter) => chapterTotal + candidateChapter.scenes.filter((candidateScene) => candidateScene.id === scene.id).length,
      0,
    ),
    0,
  );
  if (sceneMatches !== 1) throw new Error(`Scene id "${scene.id}" must be globally unique before Scene Card AI generation.`);
  if (scene.content.trim()) throw new Error("Scene Card AI generation is limited to empty scenes so it cannot overwrite author manuscript text.");

  const planning = project.storyMapPlanning ? validateStoryMapPlanningState(project.storyMapPlanning) : createStoryMapPlanningState();
  const workflow = project.sceneCardWorkflow ? validateSceneCardWorkflowState(project.sceneCardWorkflow) : createSceneCardWorkflowState();
  const details = workflow.cards[scene.id];
  if (!details) throw new Error(`Scene "${scene.id}" has no Scene Card.`);
  const attributes = planning.sceneAttributes[scene.id] ?? {
    povCharacterIds: [],
    location: "",
    storyTime: "",
    goal: "",
    conflict: "",
    outcome: "",
    emotionalBeat: "",
    tags: [],
  };
  const plotlineIds = planning.plotlines
    .filter((item) => item.bookId === book.id && item.sceneIds.includes(scene.id))
    .map((item) => item.id)
    .sort();
  const chapterCard = planning.chapterCards[chapter.id];
  const approvedChapterCard = chapterCard ? chapterCardApprovalFor(project.chapterCardWorkflow, chapter.id, chapterCard) : undefined;
  const snapshot: SceneCardSnapshot = {
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
  const approval = sceneCardApprovalFor(workflow, snapshot);
  if (!approval) throw new Error("Scene Card is no longer author-approved. Review the current Chapter Card and Scene Card, then approve the current Scene Card before AI generation.");
  if (approval.cardSha256 !== input.expectedCardSha256) throw new Error("Scene Card changed after its draft brief was issued. Request a fresh brief from the current approved card.");
  return snapshot;
}
