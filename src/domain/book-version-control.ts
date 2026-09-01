import { STUDIO_WORKSPACE_FORMAT_VERSION, validateStudioWorkspace, type WorkspaceBook, type WorkspaceChapter } from "./studio-workspace";

export const BOOK_VERSION_CONTROL_FORMAT_VERSION = 2 as const;
export type BookVersionLabel = "draft-1" | "draft-2" | "draft-3" | "final" | "published" | "custom";

export interface BookSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly label: BookVersionLabel;
  readonly name: string;
  readonly createdAt: string;
  readonly manuscript: string;
  readonly chapters: Readonly<Record<string, string>>;
  readonly parentId?: string;
  /**
   * Full structured Studio book state for lossless restore/merge. Legacy
   * snapshots remain readable without this field but cannot be destructively
   * restored as though their scene metadata still existed.
   */
  readonly workspaceBook?: WorkspaceBook;
}

export interface VersionChange {
  readonly chapterId: string;
  readonly kind: "added" | "removed" | "changed";
  readonly before?: string;
  readonly after?: string;
}

export interface BookVersionComparison {
  readonly fromId: string;
  readonly toId: string;
  readonly changes: readonly VersionChange[];
  readonly changedChapterCount: number;
  readonly identical: boolean;
}

export interface BookVersionBranch {
  readonly id: string;
  readonly projectId: string;
  readonly bookId: string;
  readonly name: string;
  readonly baseVersionId: string;
  readonly headVersionId: string;
  readonly createdAt: string;
}

export interface BookVersionHistory {
  readonly projectId: string;
  readonly bookId: string;
  readonly versions: readonly BookSnapshot[];
  readonly branches: readonly BookVersionBranch[];
}

const LABELS: readonly BookVersionLabel[] = ["draft-1", "draft-2", "draft-3", "final", "published", "custom"];
const req = (value: string, name: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createBookSnapshot(input: Omit<BookSnapshot, "id"> & { id?: string }): BookSnapshot {
  return validateBookSnapshot({ ...input, id: input.id ?? cryptoId() });
}

export function createWorkspaceBookSnapshot(input: {
  readonly id?: string;
  readonly projectId: string;
  readonly book: WorkspaceBook;
  readonly label: BookVersionLabel;
  readonly name: string;
  readonly createdAt?: string;
  readonly parentId?: string;
}): BookSnapshot {
  const book = validateWorkspaceBook(input.book);
  const derived = deriveTextState(book);
  return createBookSnapshot({
    id: input.id,
    projectId: req(input.projectId, "Project id"),
    bookId: book.id,
    label: input.label,
    name: input.name,
    createdAt: input.createdAt ?? new Date().toISOString(),
    manuscript: derived.manuscript,
    chapters: derived.chapters,
    ...(input.parentId ? { parentId: input.parentId } : {}),
    workspaceBook: book,
  });
}

export function validateBookSnapshot(value: BookSnapshot): BookSnapshot {
  if (!value || typeof value !== "object") throw new Error("Version snapshot is required.");
  req(value.id, "Version id");
  req(value.projectId, "Project id");
  req(value.bookId, "Book id");
  req(value.name, "Version name");
  req(value.createdAt, "Version createdAt");
  if (Number.isNaN(Date.parse(value.createdAt))) throw new Error("Version createdAt must be an ISO-compatible timestamp.");
  if (!LABELS.includes(value.label)) throw new Error("Invalid book version label.");
  if (typeof value.manuscript !== "string") throw new Error("Version manuscript is required.");
  if (!value.chapters || typeof value.chapters !== "object" || Array.isArray(value.chapters)) throw new Error("Version chapters are required.");
  for (const [chapterId, content] of Object.entries(value.chapters)) {
    req(chapterId, "Version chapter id");
    if (typeof content !== "string") throw new Error(`Version chapter "${chapterId}" must contain text.`);
  }
  if (value.parentId !== undefined) req(value.parentId, "Parent version id");
  const workspaceBook = value.workspaceBook === undefined ? undefined : validateWorkspaceBook(value.workspaceBook);
  if (workspaceBook && workspaceBook.id !== value.bookId) throw new Error("Version structured book id does not match snapshot book id.");
  return clone({ ...value, ...(workspaceBook ? { workspaceBook } : {}) });
}

export function extractWorkspaceBook(snapshot: BookSnapshot): WorkspaceBook {
  const validated = validateBookSnapshot(snapshot);
  if (!validated.workspaceBook) throw new Error(`Version "${validated.id}" is a legacy text-only snapshot and cannot be losslessly restored.`);
  return validateWorkspaceBook(validated.workspaceBook);
}

export function compareBookVersions(from: BookSnapshot, to: BookSnapshot): BookVersionComparison {
  const left = validateBookSnapshot(from);
  const right = validateBookSnapshot(to);
  if (left.projectId !== right.projectId || left.bookId !== right.bookId) throw new Error("Versions must belong to the same project and book.");
  const leftChapters = comparisonChapters(left);
  const rightChapters = comparisonChapters(right);
  const keys = new Set([...Object.keys(leftChapters), ...Object.keys(rightChapters)]);
  const changes: VersionChange[] = [];
  for (const chapterId of [...keys].sort()) {
    const before = leftChapters[chapterId];
    const after = rightChapters[chapterId];
    if (before === undefined) changes.push({ chapterId, kind: "added", after });
    else if (after === undefined) changes.push({ chapterId, kind: "removed", before });
    else if (before !== after) changes.push({ chapterId, kind: "changed", before, after });
  }
  return { fromId: left.id, toId: right.id, changes, changedChapterCount: changes.length, identical: changes.length === 0 };
}

export function rollbackVersion(history: BookVersionHistory, versionId: string): BookSnapshot {
  const version = history.versions.find((item) => item.id === versionId);
  if (!version) throw new Error(`Version "${versionId}" was not found.`);
  return validateBookSnapshot(version);
}

export function branchVersion(history: BookVersionHistory, input: { id?: string; name: string; baseVersionId: string; createdAt?: string }): BookVersionBranch {
  const base = history.versions.find((version) => version.id === input.baseVersionId);
  if (!base) throw new Error(`Base version "${input.baseVersionId}" was not found.`);
  if (history.branches.some((branch) => branch.name === input.name)) throw new Error(`Version branch "${input.name}" already exists.`);
  return {
    id: input.id ?? cryptoId(),
    projectId: history.projectId,
    bookId: history.bookId,
    name: req(input.name, "Branch name"),
    baseVersionId: base.id,
    headVersionId: base.id,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function mergeVersions(target: BookSnapshot, source: BookSnapshot, base: BookSnapshot): BookSnapshot {
  const current = validateBookSnapshot(target);
  const incoming = validateBookSnapshot(source);
  const ancestor = validateBookSnapshot(base);
  if (current.projectId !== incoming.projectId || current.bookId !== incoming.bookId || ancestor.projectId !== current.projectId || ancestor.bookId !== current.bookId) throw new Error("Versions must share project and book.");

  const structuredCount = [current, incoming, ancestor].filter((version) => Boolean(version.workspaceBook)).length;
  if (structuredCount > 0 && structuredCount < 3) throw new Error("Cannot merge structured and legacy text-only book versions.");
  if (structuredCount === 3) return mergeStructuredVersions(current, incoming, ancestor);

  const keys = new Set([...Object.keys(ancestor.chapters), ...Object.keys(current.chapters), ...Object.keys(incoming.chapters)]);
  const chapters: Record<string, string> = {};
  for (const chapterId of [...keys].sort()) {
    const baseValue = ancestor.chapters[chapterId];
    const targetValue = current.chapters[chapterId];
    const sourceValue = incoming.chapters[chapterId];
    const merged = mergeValue(baseValue, targetValue, sourceValue, `chapter "${chapterId}"`);
    if (merged !== undefined) chapters[chapterId] = merged;
  }
  return createBookSnapshot({
    ...current,
    id: undefined,
    label: "custom",
    name: `Merge of ${current.name} and ${incoming.name}`,
    createdAt: new Date().toISOString(),
    chapters,
    parentId: current.id,
    workspaceBook: undefined,
  });
}

function mergeStructuredVersions(target: BookSnapshot, source: BookSnapshot, base: BookSnapshot): BookSnapshot {
  const targetBook = extractWorkspaceBook(target);
  const sourceBook = extractWorkspaceBook(source);
  const baseBook = extractWorkspaceBook(base);
  const chapterIds = new Set([...baseBook.chapters.map((chapter) => chapter.id), ...targetBook.chapters.map((chapter) => chapter.id), ...sourceBook.chapters.map((chapter) => chapter.id)]);
  const chapters: WorkspaceChapter[] = [];
  for (const chapterId of [...chapterIds].sort()) {
    const baseChapter = baseBook.chapters.find((chapter) => chapter.id === chapterId);
    const targetChapter = targetBook.chapters.find((chapter) => chapter.id === chapterId);
    const sourceChapter = sourceBook.chapters.find((chapter) => chapter.id === chapterId);
    const merged = mergeObject(baseChapter, targetChapter, sourceChapter, `chapter "${chapterId}"`);
    if (merged !== undefined) chapters.push(merged);
  }
  chapters.sort((left, right) => left.number - right.number || left.id.localeCompare(right.id));
  const mergedBook: WorkspaceBook = validateWorkspaceBook({
    ...targetBook,
    title: mergeValue(baseBook.title, targetBook.title, sourceBook.title, "book title") ?? targetBook.title,
    kind: mergeValue(baseBook.kind, targetBook.kind, sourceBook.kind, "book kind") ?? targetBook.kind,
    lifecycle: mergeValue(baseBook.lifecycle, targetBook.lifecycle, sourceBook.lifecycle, "book lifecycle") ?? targetBook.lifecycle,
    description: mergeValue(baseBook.description, targetBook.description, sourceBook.description, "book description") ?? targetBook.description,
    chapters,
    updatedAt: new Date().toISOString(),
  });
  return createWorkspaceBookSnapshot({
    projectId: target.projectId,
    book: mergedBook,
    label: "custom",
    name: `Merge of ${target.name} and ${source.name}`,
    parentId: target.id,
  });
}

function comparisonChapters(snapshot: BookSnapshot): Readonly<Record<string, string>> {
  if (!snapshot.workspaceBook) return snapshot.chapters;
  return Object.fromEntries(snapshot.workspaceBook.chapters.map((chapter) => [chapter.id, JSON.stringify(chapter)]));
}

function deriveTextState(book: WorkspaceBook): { readonly manuscript: string; readonly chapters: Readonly<Record<string, string>> } {
  const chapters: Record<string, string> = {};
  const ordered = [...book.chapters].sort((left, right) => left.number - right.number || left.id.localeCompare(right.id));
  for (const chapter of ordered) {
    const scenes = [...chapter.scenes].sort((left, right) => left.number - right.number || left.id.localeCompare(right.id));
    chapters[chapter.id] = scenes.map((scene) => scene.content).join("\n\n");
  }
  return { manuscript: ordered.map((chapter) => chapters[chapter.id]).filter(Boolean).join("\n\n"), chapters };
}

function validateWorkspaceBook(value: WorkspaceBook): WorkspaceBook {
  const candidate = clone(value);
  const workspace = validateStudioWorkspace({ formatVersion: STUDIO_WORKSPACE_FORMAT_VERSION, activeBookId: candidate.id, books: [candidate] });
  return clone(workspace.books[0]);
}

function mergeObject<T>(base: T | undefined, target: T | undefined, source: T | undefined, label: string): T | undefined {
  const serialized = mergeValue(base === undefined ? undefined : JSON.stringify(base), target === undefined ? undefined : JSON.stringify(target), source === undefined ? undefined : JSON.stringify(source), label);
  return serialized === undefined ? undefined : JSON.parse(serialized) as T;
}

function mergeValue<T>(base: T | undefined, target: T | undefined, source: T | undefined, label: string): T | undefined {
  if (same(target, source)) return target;
  if (same(target, base)) return source;
  if (same(source, base)) return target;
  throw new Error(`Merge conflict in ${label}.`);
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cryptoId(): string {
  return `ver_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
