import type { ManuscriptState } from "./manuscript";

export const MANUSCRIPT_PLAN_FORMAT_VERSION = 1 as const;

export type PlanTargetType = "book" | "chapter" | "scene";
export type PlanLifecycle = "planned" | "working" | "locked" | "superseded" | "archived";

export interface ManuscriptPlan {
  readonly id: string;
  readonly projectId: string;
  readonly targetType: PlanTargetType;
  readonly targetId: string;
  readonly version: number;
  readonly lifecycle: PlanLifecycle;
  readonly purpose: string;
  readonly summary: string;
  readonly beats: readonly string[];
  readonly constraints: readonly string[];
  readonly openQuestions: readonly string[];
  readonly supersedesPlanId: string | null;
}

export interface ManuscriptPlanningState {
  readonly formatVersion: typeof MANUSCRIPT_PLAN_FORMAT_VERSION;
  readonly plans: readonly ManuscriptPlan[];
}

const LIFECYCLES: readonly PlanLifecycle[] = ["planned", "working", "locked", "superseded", "archived"];
const TARGET_TYPES: readonly PlanTargetType[] = ["book", "chapter", "scene"];

export function createManuscriptPlanningState(): ManuscriptPlanningState {
  return { formatVersion: MANUSCRIPT_PLAN_FORMAT_VERSION, plans: [] };
}

export function createManuscriptPlan(input: {
  id: string;
  projectId: string;
  targetType: PlanTargetType;
  targetId: string;
  version?: number;
  lifecycle?: PlanLifecycle;
  purpose: string;
  summary: string;
  beats?: readonly string[];
  constraints?: readonly string[];
  openQuestions?: readonly string[];
  supersedesPlanId?: string | null;
}): ManuscriptPlan {
  return freezePlan({
    id: identifier(input.id, "Plan id"),
    projectId: identifier(input.projectId, "Plan project id"),
    targetType: validValue(input.targetType, TARGET_TYPES, "plan target type"),
    targetId: identifier(input.targetId, "Plan target id"),
    version: positiveInteger(input.version ?? 1, "Plan version"),
    lifecycle: validValue(input.lifecycle ?? "planned", LIFECYCLES, "plan lifecycle"),
    purpose: text(input.purpose, "Plan purpose"),
    summary: text(input.summary, "Plan summary"),
    beats: cleanCollection(input.beats ?? [], "Plan beat"),
    constraints: cleanCollection(input.constraints ?? [], "Plan constraint"),
    openQuestions: cleanCollection(input.openQuestions ?? [], "Plan open question"),
    supersedesPlanId: input.supersedesPlanId === null || input.supersedesPlanId === undefined ? null : identifier(input.supersedesPlanId, "Superseded plan id")
  });
}

export function addManuscriptPlan(state: ManuscriptPlanningState, manuscript: ManuscriptState, plan: ManuscriptPlan): ManuscriptPlanningState {
  validateManuscriptPlanningState(state, manuscript);
  validatePlan(plan, manuscript);
  if (state.plans.some((item) => item.id === plan.id)) throw new Error(`Duplicate manuscript plan identifier "${plan.id}".`);
  if (state.plans.some((item) => currentForTarget(item, plan))) throw new Error(`A current plan already exists for ${plan.targetType} "${plan.targetId}".`);
  if (plan.supersedesPlanId !== null) throw new Error(`Plan "${plan.id}" cannot supersede a plan while being added as an initial version.`);
  return cloneState({ ...state, plans: [...state.plans, freezePlan(plan)] });
}

export function replaceManuscriptPlan(state: ManuscriptPlanningState, manuscript: ManuscriptState, plan: ManuscriptPlan): ManuscriptPlanningState {
  validateManuscriptPlanningState(state, manuscript);
  validatePlan(plan, manuscript);
  if (state.plans.some((item) => item.id === plan.id)) throw new Error(`Duplicate manuscript plan identifier "${plan.id}".`);
  const previous = state.plans.find((item) => currentForTarget(item, plan));
  if (!previous) throw new Error(`No current plan exists for ${plan.targetType} "${plan.targetId}".`);
  if (plan.projectId !== previous.projectId || plan.targetType !== previous.targetType || plan.targetId !== previous.targetId) throw new Error(`Plan replacement cannot change project or target identity.`);
  if (plan.version !== previous.version + 1) throw new Error(`Plan version must advance from ${previous.version} to ${previous.version + 1}.`);
  if (plan.supersedesPlanId !== previous.id) throw new Error(`Plan "${plan.id}" must explicitly supersede plan "${previous.id}".`);
  if (plan.lifecycle === "superseded" || plan.lifecycle === "archived") throw new Error(`Replacement plan "${plan.id}" must remain current.`);
  const plans = state.plans.map((item) => item.id === previous.id ? freezePlan({ ...item, lifecycle: "superseded" }) : freezePlan(item));
  return cloneState({ ...state, plans: [...plans, freezePlan(plan)] });
}

export function getCurrentManuscriptPlan(state: ManuscriptPlanningState, manuscript: ManuscriptState, targetType: PlanTargetType, targetId: string): ManuscriptPlan | null {
  validateManuscriptPlanningState(state, manuscript);
  identifier(targetId, "Plan target id");
  const matches = state.plans.filter((plan) => plan.targetType === targetType && plan.targetId === targetId && plan.lifecycle !== "superseded" && plan.lifecycle !== "archived");
  return matches.length === 0 ? null : [...matches].sort((a, b) => b.version - a.version || a.id.localeCompare(b.id))[0];
}

export function validateManuscriptPlanningState(state: ManuscriptPlanningState, manuscript: ManuscriptState): void {
  if (state.formatVersion !== MANUSCRIPT_PLAN_FORMAT_VERSION) throw new Error("Unsupported manuscript planning format version.");
  const ids = new Set<string>();
  for (const plan of state.plans) {
    validatePlan(plan, manuscript);
    if (ids.has(plan.id)) throw new Error(`Duplicate manuscript plan identifier "${plan.id}".`);
    ids.add(plan.id);
  }
  const targets = new Set<string>();
  for (const plan of state.plans) {
    if (plan.lifecycle === "superseded" || plan.lifecycle === "archived") continue;
    const key = `${plan.projectId}:${plan.targetType}:${plan.targetId}`;
    if (targets.has(key)) throw new Error(`Multiple current plans exist for ${plan.targetType} "${plan.targetId}".`);
    targets.add(key);
    if (plan.supersedesPlanId !== null) {
      const previous = state.plans.find((item) => item.id === plan.supersedesPlanId);
      if (!previous) throw new Error(`Plan "${plan.id}" references unknown superseded plan "${plan.supersedesPlanId}".`);
      if (previous.lifecycle !== "superseded") throw new Error(`Plan "${plan.id}" does not point to a superseded prior plan.`);
      if (previous.projectId !== plan.projectId || previous.targetType !== plan.targetType || previous.targetId !== plan.targetId) throw new Error(`Plan "${plan.id}" has an invalid supersession target.`);
      if (previous.version + 1 !== plan.version) throw new Error(`Plan "${plan.id}" has a non-sequential version.`);
    }
  }
}

function validatePlan(plan: ManuscriptPlan, manuscript: ManuscriptState): void {
  identifier(plan.id, "Plan id"); identifier(plan.projectId, "Plan project id"); identifier(plan.targetId, "Plan target id");
  validValue(plan.targetType, TARGET_TYPES, "plan target type"); validValue(plan.lifecycle, LIFECYCLES, "plan lifecycle"); positiveInteger(plan.version, "Plan version");
  text(plan.purpose, "Plan purpose"); text(plan.summary, "Plan summary"); cleanCollection(plan.beats, "Plan beat"); cleanCollection(plan.constraints, "Plan constraint"); cleanCollection(plan.openQuestions, "Plan open question");
  if (plan.supersedesPlanId !== null) identifier(plan.supersedesPlanId, "Superseded plan id");
  const projectBook = manuscript.books.find((book) => book.id === plan.targetId);
  if (plan.targetType === "book") {
    if (!projectBook) throw new Error(`Plan "${plan.id}" references unknown book "${plan.targetId}".`);
    if (projectBook.projectId !== plan.projectId) throw new Error(`Plan "${plan.id}" targets a book outside project "${plan.projectId}".`);
    return;
  }
  const chapter = manuscript.chapters.find((item) => item.id === plan.targetId);
  if (plan.targetType === "chapter") {
    if (!chapter) throw new Error(`Plan "${plan.id}" references unknown chapter "${plan.targetId}".`);
    const book = manuscript.books.find((item) => item.id === chapter.bookId);
    if (!book || book.projectId !== plan.projectId) throw new Error(`Plan "${plan.id}" targets a chapter outside project "${plan.projectId}".`);
    return;
  }
  const scene = manuscript.scenes.find((item) => item.id === plan.targetId);
  if (!scene) throw new Error(`Plan "${plan.id}" references unknown scene "${plan.targetId}".`);
  const parentChapter = manuscript.chapters.find((item) => item.id === scene.chapterId);
  const parentBook = parentChapter ? manuscript.books.find((item) => item.id === parentChapter.bookId) : undefined;
  if (!parentChapter || !parentBook || parentBook.projectId !== plan.projectId) throw new Error(`Plan "${plan.id}" targets a scene outside project "${plan.projectId}".`);
}

function currentForTarget(left: ManuscriptPlan, right: ManuscriptPlan): boolean { return left.projectId === right.projectId && left.targetType === right.targetType && left.targetId === right.targetId && left.lifecycle !== "superseded" && left.lifecycle !== "archived"; }
function identifier(value: string, label: string): string { if (!value.trim()) throw new Error(`${label} is required.`); if (value !== value.trim()) throw new Error(`${label} cannot have leading or trailing whitespace.`); return value; }
function text(value: string, label: string): string { if (!value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function positiveInteger(value: number, label: string): number { if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`); return value; }
function validValue<T extends string>(value: T, allowed: readonly T[], label: string): T { if (!allowed.includes(value)) throw new Error(`Invalid ${label} "${value}".`); return value; }
function cleanCollection(values: readonly string[], label: string): readonly string[] { return values.map((value) => text(value, label)); }
function freezePlan(plan: ManuscriptPlan): ManuscriptPlan { return Object.freeze({ ...plan, beats: Object.freeze([...plan.beats]), constraints: Object.freeze([...plan.constraints]), openQuestions: Object.freeze([...plan.openQuestions]) }); }
function cloneState(state: ManuscriptPlanningState): ManuscriptPlanningState { return { formatVersion: state.formatVersion, plans: state.plans.map(freezePlan) }; }
