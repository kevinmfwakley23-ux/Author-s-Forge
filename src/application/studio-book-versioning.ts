import { createAuthorDecision } from "../domain/author-control";
import {
  branchVersion,
  compareBookVersions,
  createBookSnapshot,
  createWorkspaceBookSnapshot,
  extractWorkspaceBook,
  mergeVersions,
  type BookSnapshot,
  type BookVersionBranch,
  type BookVersionComparison,
  type BookVersionHistory,
  type BookVersionLabel,
} from "../domain/book-version-control";
import {
  withProjectAuthorDecisions,
  withProjectBookVersionHistories,
  withProjectStudioWorkspace,
  type ProjectState,
} from "../domain/project";
import { getBook, validateStudioWorkspace } from "../domain/studio-workspace";
import { FileProjectStore } from "../infrastructure/file-project-store";

export interface CaptureBookVersionInput {
  readonly id?: string;
  readonly label: BookVersionLabel;
  readonly name: string;
  readonly now?: string;
}

export interface RestoreBookVersionInput {
  readonly authorApproved: boolean;
  readonly reason: string;
  readonly rollbackVersionId?: string;
  readonly decisionId?: string;
  readonly now?: string;
}

export interface MergeBookVersionsInput {
  readonly targetVersionId: string;
  readonly sourceVersionId: string;
  readonly baseVersionId: string;
  readonly mergedVersionId?: string;
  readonly name?: string;
  readonly branchId?: string;
  readonly now?: string;
}

export interface BookVersionRestoreResult {
  readonly project: ProjectState;
  readonly restoredVersion: BookSnapshot;
  readonly rollbackVersion: BookSnapshot;
}

export class StudioBookVersioningService {
  public constructor(private readonly store: FileProjectStore) {}

  public async list(projectId: string, bookId: string): Promise<BookVersionHistory> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    return clone(this.history(project, bookId));
  }

  public async capture(projectId: string, bookId: string, input: CaptureBookVersionInput): Promise<BookSnapshot> {
    const project = await this.load(projectId);
    const book = this.requireBook(project, bookId);
    const history = this.history(project, bookId);
    const snapshot = createWorkspaceBookSnapshot({
      id: input.id,
      projectId,
      book,
      label: input.label,
      name: input.name,
      createdAt: input.now,
      ...(history.versions.at(-1) ? { parentId: history.versions.at(-1)!.id } : {}),
    });
    await this.saveHistory(project, { ...history, versions: [...history.versions, snapshot] }, input.now);
    return snapshot;
  }

  public async compare(projectId: string, bookId: string, fromVersionId: string, toVersionId: string): Promise<BookVersionComparison> {
    const history = await this.list(projectId, bookId);
    return compareBookVersions(this.version(history, fromVersionId), this.version(history, toVersionId));
  }

  public async createBranch(projectId: string, bookId: string, input: { readonly id?: string; readonly name: string; readonly baseVersionId: string; readonly now?: string }): Promise<BookVersionBranch> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    const history = this.history(project, bookId);
    const branch = branchVersion(history, { id: input.id, name: input.name, baseVersionId: input.baseVersionId, createdAt: input.now });
    await this.saveHistory(project, { ...history, branches: [...history.branches, branch] }, input.now);
    return branch;
  }

  public async merge(projectId: string, bookId: string, input: MergeBookVersionsInput): Promise<BookSnapshot> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    const history = this.history(project, bookId);
    const target = this.version(history, input.targetVersionId);
    const source = this.version(history, input.sourceVersionId);
    const base = this.version(history, input.baseVersionId);
    const candidate = mergeVersions(target, source, base);
    const merged = createBookSnapshot({
      ...candidate,
      id: input.mergedVersionId,
      name: input.name?.trim() || candidate.name,
      createdAt: input.now ?? candidate.createdAt,
    });
    let branches = [...history.branches];
    if (input.branchId) {
      const index = branches.findIndex((branch) => branch.id === input.branchId);
      if (index < 0) throw new Error(`Version branch "${input.branchId}" was not found.`);
      const branch = branches[index];
      if (branch.headVersionId !== target.id) throw new Error(`Version branch "${input.branchId}" is not currently based on target version "${target.id}".`);
      branches[index] = { ...branch, headVersionId: merged.id };
    }
    await this.saveHistory(project, { ...history, versions: [...history.versions, merged], branches }, input.now);
    return merged;
  }

  public async restore(projectId: string, bookId: string, versionId: string, input: RestoreBookVersionInput): Promise<BookVersionRestoreResult> {
    if (input.authorApproved !== true) throw new Error("Explicit author approval is required before restoring a book version.");
    if (typeof input.reason !== "string" || !input.reason.trim()) throw new Error("A reason is required before restoring a book version.");
    const now = input.now ?? new Date().toISOString();
    const project = await this.load(projectId);
    const currentBook = this.requireBook(project, bookId);
    const history = this.history(project, bookId);
    const target = this.version(history, versionId);
    const restoredBook = extractWorkspaceBook(target);
    const rollback = createWorkspaceBookSnapshot({
      id: input.rollbackVersionId,
      projectId,
      book: currentBook,
      label: "custom",
      name: `Rollback checkpoint before restoring ${target.name}`,
      createdAt: now,
      ...(history.versions.at(-1) ? { parentId: history.versions.at(-1)!.id } : {}),
    });

    const workspace = validateStudioWorkspace(project.studioWorkspace);
    const restoredWorkspace = validateStudioWorkspace({
      ...workspace,
      books: workspace.books.map((book) => book.id === bookId ? restoredBook : book),
      activeBookId: workspace.activeBookId ?? bookId,
    });
    const updatedHistory: BookVersionHistory = { ...history, versions: [...history.versions, rollback] };
    const histories = replaceHistory(project.bookVersionHistories ?? [], updatedHistory);
    const decision = createAuthorDecision({
      id: input.decisionId,
      projectId,
      targetId: `book:${bookId}:version-restore`,
      status: "author-approved",
      content: JSON.stringify({ restoredVersionId: target.id, rollbackVersionId: rollback.id }),
      reason: input.reason.trim(),
      createdAt: now,
    });

    let next = withProjectStudioWorkspace(project, restoredWorkspace, now);
    next = withProjectBookVersionHistories(next, histories, now);
    next = withProjectAuthorDecisions(next, [...(project.authorDecisions ?? []), decision], now);
    await this.store.save(next);
    const persisted = await this.load(projectId);
    return { project: persisted, restoredVersion: target, rollbackVersion: rollback };
  }

  private async saveHistory(project: ProjectState, history: BookVersionHistory, now?: string): Promise<void> {
    await this.store.save(withProjectBookVersionHistories(project, replaceHistory(project.bookVersionHistories ?? [], history), now));
  }

  private async load(projectId: string): Promise<ProjectState> {
    if (typeof projectId !== "string" || !projectId.trim()) throw new Error("Project id is required for book versioning.");
    const project = await this.store.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" was not found.`);
    return project;
  }

  private requireBook(project: ProjectState, bookId: string) {
    if (!project.studioWorkspace) throw new Error("Project has no Studio workspace.");
    return getBook(validateStudioWorkspace(project.studioWorkspace), bookId);
  }

  private history(project: ProjectState, bookId: string): BookVersionHistory {
    return project.bookVersionHistories?.find((history) => history.bookId === bookId) ?? { projectId: project.metadata.id, bookId, versions: [], branches: [] };
  }

  private version(history: BookVersionHistory, versionId: string): BookSnapshot {
    const version = history.versions.find((item) => item.id === versionId);
    if (!version) throw new Error(`Version "${versionId}" was not found.`);
    return version;
  }
}

function replaceHistory(histories: readonly BookVersionHistory[], next: BookVersionHistory): BookVersionHistory[] {
  const filtered = histories.filter((history) => history.bookId !== next.bookId);
  return [...filtered, clone(next)];
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
