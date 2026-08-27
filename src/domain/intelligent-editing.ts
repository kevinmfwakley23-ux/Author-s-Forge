export const EDITING_FORMAT_VERSION = 1 as const;

export type EditorRole = "developmental" | "continuity" | "line" | "copy" | "proofreading" | "structural" | "dialogue" | "pacing" | "character" | "genre";
export type FindingSeverity = "info" | "suggestion" | "warning" | "critical";
export type FindingKind = "pacing" | "character-consistency" | "plot-hole" | "continuity-conflict" | "repetition" | "weak-scene" | "unresolved-thread" | "unnecessary-exposition" | "dialogue-problem" | "pov-violation" | "tense-inconsistency" | "cliche" | "overused-word" | "sentence-rhythm" | "chapter-balance" | "genre-fit";

export interface EditingTarget { readonly projectId: string; readonly manuscriptId: string; readonly chapterId?: string; readonly sceneId?: string; }
export interface EditingDocument {
  readonly target: EditingTarget; readonly title: string; readonly text: string;
  readonly pov?: "first" | "second" | "third"; readonly tense?: "past" | "present";
  readonly expectedCharacterNames?: readonly string[]; readonly requiredFacts?: readonly string[];
  readonly unresolvedThreads?: readonly string[]; readonly genreExpectations?: readonly string[];
}
export interface EditorialFinding {
  readonly id: string; readonly role: EditorRole; readonly kind: FindingKind; readonly severity: FindingSeverity;
  readonly message: string; readonly recommendation: string; readonly start: number; readonly end: number;
  readonly excerpt: string; readonly confidence: number; readonly manuscriptMutationAuthorized: false;
}
export interface EditorialReport {
  readonly formatVersion: typeof EDITING_FORMAT_VERSION; readonly id: string; readonly target: EditingTarget;
  readonly roles: readonly EditorRole[]; readonly findings: readonly EditorialFinding[]; readonly summary: string;
  readonly generatedAt: string; readonly manuscriptMutated: false;
}

export const EDITOR_ROLES: readonly EditorRole[] = ["developmental", "continuity", "line", "copy", "proofreading", "structural", "dialogue", "pacing", "character", "genre"];
export const FINDING_KINDS: readonly FindingKind[] = ["pacing", "character-consistency", "plot-hole", "continuity-conflict", "repetition", "weak-scene", "unresolved-thread", "unnecessary-exposition", "dialogue-problem", "pov-violation", "tense-inconsistency", "cliche", "overused-word", "sentence-rhythm", "chapter-balance", "genre-fit"];

export function createEditingDocument(input: EditingDocument): EditingDocument {
  if (!input.target.projectId.trim()) throw new Error("Editing project id is required.");
  if (!input.target.manuscriptId.trim()) throw new Error("Editing manuscript id is required.");
  if (!input.title.trim()) throw new Error("Editing title is required.");
  if (!input.text.trim()) throw new Error("Editing document text is required.");
  if (input.pov && !["first", "second", "third"].includes(input.pov)) throw new Error(`Invalid POV "${input.pov}".`);
  if (input.tense && !["past", "present"].includes(input.tense)) throw new Error(`Invalid tense "${input.tense}".`);
  return { ...input, title: input.title.trim() };
}
export function createEditorialFinding(input: Omit<EditorialFinding, "manuscriptMutationAuthorized">): EditorialFinding {
  if (!input.id.trim()) throw new Error("Editorial finding id is required.");
  if (input.start < 0 || input.end < input.start) throw new Error("Editorial finding range is invalid.");
  if (input.confidence < 0 || input.confidence > 1) throw new Error("Editorial finding confidence must be between 0 and 1.");
  return Object.freeze({ ...input, manuscriptMutationAuthorized: false as const });
}
export function createEditorialReport(input: Omit<EditorialReport, "formatVersion" | "manuscriptMutated">): EditorialReport {
  if (!input.id.trim()) throw new Error("Editorial report id is required.");
  const ids = new Set<string>();
  for (const finding of input.findings) { if (ids.has(finding.id)) throw new Error(`Duplicate editorial finding identifier "${finding.id}".`); ids.add(finding.id); }
  return Object.freeze({ ...input, formatVersion: EDITING_FORMAT_VERSION, manuscriptMutated: false as const });
}
export function validateEditorialReport(report: EditorialReport, sourceText: string): void {
  if (report.formatVersion !== EDITING_FORMAT_VERSION) throw new Error("Unsupported editorial report format version.");
  if (report.manuscriptMutated) throw new Error("Editorial analysis cannot mutate the manuscript.");
  const ids = new Set<string>();
  for (const finding of report.findings) {
    if (ids.has(finding.id)) throw new Error(`Duplicate editorial finding identifier "${finding.id}".`);
    ids.add(finding.id);
    if (finding.start < 0 || finding.end < finding.start || finding.end > sourceText.length) throw new Error(`Editorial finding "${finding.id}" has an invalid source range.`);
    if (sourceText.slice(finding.start, finding.end) !== finding.excerpt) throw new Error(`Editorial finding "${finding.id}" excerpt does not match source.`);
    if (finding.manuscriptMutationAuthorized !== false) throw new Error(`Editorial finding "${finding.id}" illegally authorizes mutation.`);
  }
}
