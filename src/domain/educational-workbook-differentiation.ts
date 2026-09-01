import { WORKBOOK_DIFFICULTIES, WORKBOOK_GRADE_BANDS, type WorkbookDifficulty, type WorkbookGradeBand, type WorkbookSubject } from "./educational-workbook";

export const EDUCATIONAL_DIFFERENTIATION_FORMAT_VERSION = 1 as const;
export const EDUCATIONAL_DIFFERENTIATION_TIERS = ["support", "core", "extension"] as const;
export type EducationalDifferentiationTier = typeof EDUCATIONAL_DIFFERENTIATION_TIERS[number];

export interface EducationalDifferentiationReadinessTier {
  readonly tier: EducationalDifferentiationTier;
  readonly difficulty: WorkbookDifficulty;
  readonly eligibleActivityCount: number;
  readonly requiredActivityCount: number;
  readonly ready: boolean;
}

export interface EducationalDifferentiationReadiness {
  readonly projectId: string;
  readonly gradeBand: WorkbookGradeBand;
  readonly requestedActivityCountPerVariant: number;
  readonly tiers: readonly EducationalDifferentiationReadinessTier[];
  readonly ready: boolean;
}

export interface EducationalDifferentiationVariant {
  readonly tier: EducationalDifferentiationTier;
  readonly label: string;
  readonly workbookId: string;
  readonly difficulty: WorkbookDifficulty;
  readonly learnerSupports: readonly string[];
  readonly teacherNotes: readonly string[];
}

export interface EducationalDifferentiationPack {
  readonly formatVersion: typeof EDUCATIONAL_DIFFERENTIATION_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly gradeBand: WorkbookGradeBand;
  readonly generatedAt: string;
  readonly learningObjectives: readonly string[];
  readonly standards: readonly string[];
  readonly tags: readonly string[];
  readonly subjects: readonly WorkbookSubject[];
  readonly activityCountPerVariant: number;
  readonly variants: readonly EducationalDifferentiationVariant[];
}

export interface CreateEducationalDifferentiationPackInput {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly gradeBand: WorkbookGradeBand;
  readonly learningObjectives: readonly string[];
  readonly standards?: readonly string[];
  readonly tags?: readonly string[];
  readonly subjects?: readonly WorkbookSubject[];
  readonly activityCountPerVariant: number;
  readonly variants: readonly EducationalDifferentiationVariant[];
  readonly now?: string;
}

export function createEducationalDifferentiationPack(input: CreateEducationalDifferentiationPackInput): EducationalDifferentiationPack {
  const pack: EducationalDifferentiationPack = Object.freeze({
    formatVersion: EDUCATIONAL_DIFFERENTIATION_FORMAT_VERSION,
    id: required(input.id, "Differentiation pack id"),
    projectId: required(input.projectId, "Project id"),
    title: required(input.title, "Differentiation pack title"),
    gradeBand: gradeBand(input.gradeBand),
    generatedAt: iso(input.now ?? new Date().toISOString(), "Differentiation pack generatedAt"),
    learningObjectives: Object.freeze(uniqueStrings(input.learningObjectives)),
    standards: Object.freeze(uniqueStrings(input.standards ?? [])),
    tags: Object.freeze(uniqueStrings(input.tags ?? [])),
    subjects: Object.freeze(uniqueSubjects(input.subjects ?? [])),
    activityCountPerVariant: activityCount(input.activityCountPerVariant),
    variants: Object.freeze(input.variants.map(validateVariant)),
  });
  validateEducationalDifferentiationPack(pack);
  return pack;
}

export function validateEducationalDifferentiationPack(pack: EducationalDifferentiationPack): void {
  if (pack.formatVersion !== EDUCATIONAL_DIFFERENTIATION_FORMAT_VERSION) throw new Error("Unsupported Educational Workbook differentiation format.");
  required(pack.id, "Differentiation pack id");
  required(pack.projectId, "Project id");
  required(pack.title, "Differentiation pack title");
  gradeBand(pack.gradeBand);
  iso(pack.generatedAt, "Differentiation pack generatedAt");
  if (!pack.learningObjectives.length) throw new Error("Differentiation pack requires at least one learning objective.");
  activityCount(pack.activityCountPerVariant);
  const tiers = pack.variants.map((variant) => validateVariant(variant).tier);
  if (tiers.length !== EDUCATIONAL_DIFFERENTIATION_TIERS.length || new Set(tiers).size !== tiers.length) throw new Error("Differentiation pack must contain exactly one support, core, and extension variant.");
  for (const tier of EDUCATIONAL_DIFFERENTIATION_TIERS) if (!tiers.includes(tier)) throw new Error(`Differentiation pack is missing the ${tier} variant.`);
  const workbookIds = pack.variants.map((variant) => variant.workbookId);
  if (new Set(workbookIds).size !== workbookIds.length) throw new Error("Differentiation variants must reference unique workbook editions.");
  uniqueSubjects(pack.subjects);
  uniqueStrings(pack.standards);
  uniqueStrings(pack.tags);
}

export function differentiationDifficulty(tier: EducationalDifferentiationTier): WorkbookDifficulty {
  if (tier === "support") return "intro";
  if (tier === "core") return "practice";
  return "challenge";
}

export function defaultLearnerSupports(tier: EducationalDifferentiationTier): readonly string[] {
  if (tier === "support") return Object.freeze([
    "Work through one task at a time and pause between directions when needed.",
    "Preview or define unfamiliar vocabulary before independent work.",
    "Use a worked example, manipulatives, oral response, or sentence frames when those supports fit the learning goal.",
    "Prioritize accurate understanding over speed.",
  ]);
  if (tier === "core") return Object.freeze([
    "Review the learning objective before beginning.",
    "Show or explain reasoning when the activity provides response space.",
    "Use answer explanations for feedback after the learner has attempted the task.",
  ]);
  return Object.freeze([
    "Explain reasoning and compare strategies when the activity allows it.",
    "Connect the skill to a new example, context, or transfer task after core work is complete.",
    "Use reflection to identify what made the challenge difficult and what strategy worked.",
  ]);
}

export function defaultTeacherNotes(tier: EducationalDifferentiationTier): readonly string[] {
  if (tier === "support") return Object.freeze([
    "This version draws only from activities explicitly classified as intro difficulty in the durable activity bank.",
    "Offer scaffolds without changing the intended learning objective; remove a scaffold when the learner no longer needs it.",
    "Do not treat the support tier as a diagnosis, placement decision, or replacement for an individualized education plan.",
  ]);
  if (tier === "core") return Object.freeze([
    "This version draws only from practice-difficulty activities and represents the office's default independent-practice tier.",
    "Use learner responses and explanations as evidence for reteaching or extension decisions.",
  ]);
  return Object.freeze([
    "This version draws only from challenge-difficulty activities in the approved activity bank.",
    "Extension should deepen reasoning or transfer rather than simply increase workload.",
  ]);
}

function validateVariant(value: EducationalDifferentiationVariant): EducationalDifferentiationVariant {
  if (!value || typeof value !== "object") throw new Error("Invalid Educational Workbook differentiation variant.");
  if (!EDUCATIONAL_DIFFERENTIATION_TIERS.includes(value.tier)) throw new Error("Invalid differentiation tier.");
  if (!WORKBOOK_DIFFICULTIES.includes(value.difficulty)) throw new Error("Invalid differentiation difficulty.");
  if (value.difficulty !== differentiationDifficulty(value.tier)) throw new Error(`Differentiation tier ${value.tier} must use ${differentiationDifficulty(value.tier)} difficulty.`);
  const learnerSupports = uniqueStrings(value.learnerSupports);
  const teacherNotes = uniqueStrings(value.teacherNotes);
  if (!learnerSupports.length) throw new Error(`Differentiation tier ${value.tier} requires learner supports.`);
  if (!teacherNotes.length) throw new Error(`Differentiation tier ${value.tier} requires teacher notes.`);
  return Object.freeze({
    tier: value.tier,
    label: required(value.label, "Differentiation variant label"),
    workbookId: required(value.workbookId, "Differentiation workbook id"),
    difficulty: value.difficulty,
    learnerSupports: Object.freeze(learnerSupports),
    teacherNotes: Object.freeze(teacherNotes),
  });
}

function uniqueSubjects(values: readonly WorkbookSubject[]): WorkbookSubject[] {
  return [...new Set(values)];
}
function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}
function gradeBand(value: WorkbookGradeBand): WorkbookGradeBand {
  if (!WORKBOOK_GRADE_BANDS.includes(value)) throw new Error("Unsupported workbook grade band.");
  return value;
}
function activityCount(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 200) throw new Error("Differentiation activity count per variant must be an integer from 1 to 200.");
  return value;
}
function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function iso(value: string, label: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} must be a valid timestamp.`);
  return parsed.toISOString();
}
