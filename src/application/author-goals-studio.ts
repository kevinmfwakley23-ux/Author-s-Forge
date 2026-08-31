import { createAuthorGoal, createAuthorGoalsSnapshot, type AuthorGoal, type AuthorGoalsSnapshot } from "../domain/author-goals";
import { addBook, addChapter, addScene, createBook, createChapter, createManuscriptState, createScene, type ManuscriptState } from "../domain/manuscript";
import { validateStudioWorkspace, type StudioWorkspaceState } from "../domain/studio-workspace";
import type { FileProjectStore } from "../infrastructure/file-project-store";

export interface StudioAuthorGoalsProjectState {
  readonly metadata: { readonly id: string; readonly updatedAt: string };
  readonly studioWorkspace?: StudioWorkspaceState;
  readonly authorGoals?: readonly AuthorGoal[];
  readonly [key: string]: unknown;
}

export class StudioAuthorGoalsService {
  constructor(private readonly projects: Pick<FileProjectStore, "load" | "save">) {}

  async list(projectId: string): Promise<readonly AuthorGoal[]> {
    const project = await this.requireProject(projectId);
    return cloneGoals(project.authorGoals ?? []);
  }

  async replace(projectId: string, goals: readonly AuthorGoal[], now = new Date().toISOString()): Promise<readonly AuthorGoal[]> {
    const project = await this.requireProject(projectId);
    const validated = validateGoals(goals);
    await this.projects.save({ ...project, authorGoals: validated, metadata: { ...project.metadata, updatedAt: now } } as never);
    return cloneGoals(validated);
  }

  async upsert(projectId: string, goal: AuthorGoal, now = new Date().toISOString()): Promise<readonly AuthorGoal[]> {
    const project = await this.requireProject(projectId);
    const validatedGoal = validateGoal(goal);
    const current = project.authorGoals ?? [];
    const next = [...current.filter((item) => item.id !== validatedGoal.id), validatedGoal].sort((a, b) => a.id.localeCompare(b.id));
    await this.projects.save({ ...project, authorGoals: next, metadata: { ...project.metadata, updatedAt: now } } as never);
    return cloneGoals(next);
  }

  async remove(projectId: string, goalId: string, now = new Date().toISOString()): Promise<readonly AuthorGoal[]> {
    if (!goalId.trim()) throw new Error("Author goal id is required.");
    const project = await this.requireProject(projectId);
    const current = project.authorGoals ?? [];
    if (!current.some((goal) => goal.id === goalId)) throw new Error(`Author goal "${goalId}" not found.`);
    const next = current.filter((goal) => goal.id !== goalId);
    await this.projects.save({ ...project, authorGoals: next, metadata: { ...project.metadata, updatedAt: now } } as never);
    return cloneGoals(next);
  }

  async snapshot(projectId: string): Promise<AuthorGoalsSnapshot> {
    const project = await this.requireProject(projectId);
    const workspace = project.studioWorkspace
      ? validateStudioWorkspace(project.studioWorkspace)
      : validateStudioWorkspace({ formatVersion: 1, activeBookId: null, books: [] });
    const manuscript = projectWorkspace(workspace, projectId);
    const wordCount = workspace.books.reduce((bookTotal, book) => bookTotal + book.chapters.reduce((chapterTotal, chapter) => chapterTotal + chapter.scenes.reduce((sceneTotal, scene) => sceneTotal + scene.wordCount, 0), 0), 0);
    return createAuthorGoalsSnapshot(manuscript, validateGoals(project.authorGoals ?? []), wordCount);
  }

  private async requireProject(projectId: string): Promise<StudioAuthorGoalsProjectState> {
    if (!projectId.trim()) throw new Error("Project id is required.");
    const project = await this.projects.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" not found.`);
    return project as unknown as StudioAuthorGoalsProjectState;
  }
}

function projectWorkspace(workspace: StudioWorkspaceState, projectId: string): ManuscriptState {
  let manuscript = createManuscriptState();
  for (const book of workspace.books) {
    manuscript = addBook(manuscript, createBook({ id: book.id, projectId, title: book.title, lifecycle: book.lifecycle === "complete" ? "completed" : book.lifecycle }));
    for (const chapter of book.chapters) {
      manuscript = addChapter(manuscript, createChapter({ id: chapter.id, bookId: book.id, number: chapter.number, title: chapter.title, lifecycle: chapter.lifecycle === "active" ? "drafting" : chapter.lifecycle }));
      for (const scene of chapter.scenes) {
        manuscript = addScene(manuscript, createScene({ id: scene.id, chapterId: chapter.id, order: scene.number, title: scene.title, lifecycle: scene.lifecycle === "active" ? "drafting" : scene.lifecycle }));
      }
    }
  }
  return manuscript;
}

function validateGoals(goals: readonly AuthorGoal[]): AuthorGoal[] {
  const ids = new Set<string>();
  return goals.map((goal) => {
    const validated = validateGoal(goal);
    if (ids.has(validated.id)) throw new Error(`Duplicate author goal id "${validated.id}".`);
    ids.add(validated.id);
    return validated;
  });
}

function validateGoal(goal: AuthorGoal): AuthorGoal {
  return createAuthorGoal({ id: goal.id, metric: goal.metric, target: goal.target, period: goal.period, label: goal.label });
}

function cloneGoals(goals: readonly AuthorGoal[]): AuthorGoal[] { return goals.map((goal) => ({ ...goal })); }
