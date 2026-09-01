export const EDUCATIONAL_ASSESSMENT_FORMAT_VERSION = 1 as const;
export const EDUCATIONAL_RESPONSE_MODES = ["written", "oral", "drawing", "diagram", "model", "demonstration", "digital", "other"] as const;
export type EducationalResponseMode = typeof EDUCATIONAL_RESPONSE_MODES[number];
export const EDUCATIONAL_MASTERY_BANDS = ["emerging", "developing", "proficient", "advanced"] as const;
export type EducationalMasteryBand = typeof EDUCATIONAL_MASTERY_BANDS[number];

export interface EducationalRubricLevel {
  readonly id: string;
  readonly label: string;
  readonly score: number;
  readonly description: string;
}
export interface EducationalRubricCriterion {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly weightPercent: number;
  readonly learningObjective: string;
  readonly evidenceGuidance: string;
}
export interface EducationalRubric {
  readonly formatVersion: typeof EDUCATIONAL_ASSESSMENT_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly gradeBand: string;
  readonly standards: readonly string[];
  readonly allowedResponseModes: readonly EducationalResponseMode[];
  readonly criteria: readonly EducationalRubricCriterion[];
  readonly levels: readonly EducationalRubricLevel[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
export interface EducationalAssessmentScore {
  readonly criterionId: string;
  readonly levelId: string;
  readonly evidenceNote: string;
}
export interface EducationalAssessmentRecord {
  readonly formatVersion: typeof EDUCATIONAL_ASSESSMENT_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly rubricId: string;
  readonly activityOrTaskId: string;
  readonly responseMode: EducationalResponseMode;
  readonly scores: readonly EducationalAssessmentScore[];
  readonly weightedPercent: number;
  readonly masteryBand: EducationalMasteryBand;
  readonly feedback: string;
  readonly recordedAt: string;
}

export function createEducationalRubric(input: {
  readonly id: string; readonly projectId: string; readonly title: string; readonly description?: string; readonly gradeBand: string;
  readonly standards?: readonly string[]; readonly allowedResponseModes?: readonly EducationalResponseMode[];
  readonly criteria: readonly EducationalRubricCriterion[]; readonly levels: readonly EducationalRubricLevel[]; readonly now?: string;
}): EducationalRubric {
  const now = iso(input.now ?? new Date().toISOString(), "Rubric timestamp");
  const criteria = input.criteria.map(validateCriterion);
  const levels = input.levels.map(validateLevel).sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  if (criteria.length < 1 || criteria.length > 20) throw new Error("Rubric requires 1 to 20 criteria.");
  if (levels.length < 2 || levels.length > 8) throw new Error("Rubric requires 2 to 8 performance levels.");
  uniqueIds(criteria.map((item) => item.id), "rubric criterion");
  uniqueIds(levels.map((item) => item.id), "rubric level");
  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weightPercent, 0);
  if (Math.abs(totalWeight - 100) > 0.001) throw new Error(`Rubric criterion weights must total 100%; received ${totalWeight}%.`);
  const modes = uniqueModes(input.allowedResponseModes?.length ? input.allowedResponseModes : ["written"]);
  return Object.freeze({
    formatVersion: EDUCATIONAL_ASSESSMENT_FORMAT_VERSION,
    id: required(input.id, "Rubric id"), projectId: required(input.projectId, "Project id"), title: required(input.title, "Rubric title"),
    description: optional(input.description), gradeBand: required(input.gradeBand, "Rubric grade band"), standards: Object.freeze(uniqueStrings(input.standards ?? [])),
    allowedResponseModes: Object.freeze(modes), criteria: Object.freeze(criteria), levels: Object.freeze(levels), createdAt: now, updatedAt: now,
  });
}

export function validateEducationalRubric(value: EducationalRubric): EducationalRubric {
  if (!value || typeof value !== "object" || value.formatVersion !== EDUCATIONAL_ASSESSMENT_FORMAT_VERSION) throw new Error("Invalid or unsupported educational rubric.");
  return createEducationalRubric({ id: value.id, projectId: value.projectId, title: value.title, description: value.description, gradeBand: value.gradeBand, standards: value.standards, allowedResponseModes: value.allowedResponseModes, criteria: value.criteria, levels: value.levels, now: value.createdAt });
}

export function scoreEducationalAssessment(input: {
  readonly id: string; readonly projectId: string; readonly rubric: EducationalRubric; readonly activityOrTaskId: string;
  readonly responseMode: EducationalResponseMode; readonly scores: readonly EducationalAssessmentScore[]; readonly feedback?: string; readonly now?: string;
}): EducationalAssessmentRecord {
  const rubric = validateEducationalRubric(input.rubric);
  if (rubric.projectId !== required(input.projectId, "Project id")) throw new Error("Assessment rubric belongs to another project.");
  if (!rubric.allowedResponseModes.includes(input.responseMode)) throw new Error(`Response mode "${input.responseMode}" is not allowed by this rubric.`);
  if (!Array.isArray(input.scores) || input.scores.length !== rubric.criteria.length) throw new Error("Assessment requires exactly one score for every rubric criterion.");
  const scoreMap = new Map<string, EducationalAssessmentScore>();
  for (const score of input.scores) {
    if (!score || typeof score !== "object") throw new Error("Invalid rubric score.");
    const criterionId = required(score.criterionId, "Assessment criterion id");
    if (scoreMap.has(criterionId)) throw new Error(`Duplicate score for criterion "${criterionId}".`);
    if (!rubric.criteria.some((criterion) => criterion.id === criterionId)) throw new Error(`Unknown rubric criterion "${criterionId}".`);
    const levelId = required(score.levelId, "Assessment level id");
    if (!rubric.levels.some((level) => level.id === levelId)) throw new Error(`Unknown rubric level "${levelId}".`);
    scoreMap.set(criterionId, Object.freeze({ criterionId, levelId, evidenceNote: optional(score.evidenceNote) }));
  }
  for (const criterion of rubric.criteria) if (!scoreMap.has(criterion.id)) throw new Error(`Missing score for criterion "${criterion.id}".`);
  const minScore = Math.min(...rubric.levels.map((level) => level.score));
  const maxScore = Math.max(...rubric.levels.map((level) => level.score));
  if (maxScore <= minScore) throw new Error("Rubric performance levels must span more than one numeric score.");
  let weighted = 0;
  for (const criterion of rubric.criteria) {
    const score = scoreMap.get(criterion.id)!;
    const level = rubric.levels.find((item) => item.id === score.levelId)!;
    const normalized = (level.score - minScore) / (maxScore - minScore);
    weighted += normalized * criterion.weightPercent;
  }
  const weightedPercent = Math.round(weighted * 10) / 10;
  return Object.freeze({
    formatVersion: EDUCATIONAL_ASSESSMENT_FORMAT_VERSION,
    id: required(input.id, "Assessment id"), projectId: rubric.projectId, rubricId: rubric.id,
    activityOrTaskId: required(input.activityOrTaskId, "Activity or task id"), responseMode: input.responseMode,
    scores: Object.freeze(rubric.criteria.map((criterion) => scoreMap.get(criterion.id)!)), weightedPercent,
    masteryBand: masteryBand(weightedPercent), feedback: optional(input.feedback), recordedAt: iso(input.now ?? new Date().toISOString(), "Assessment timestamp"),
  });
}

export function validateEducationalAssessmentRecord(value: EducationalAssessmentRecord, rubric: EducationalRubric): EducationalAssessmentRecord {
  const rescored = scoreEducationalAssessment({ id: value.id, projectId: value.projectId, rubric, activityOrTaskId: value.activityOrTaskId, responseMode: value.responseMode, scores: value.scores, feedback: value.feedback, now: value.recordedAt });
  if (Math.abs(rescored.weightedPercent - value.weightedPercent) > 0.001 || rescored.masteryBand !== value.masteryBand) throw new Error("Stored assessment score does not match rubric calculation.");
  return rescored;
}

function masteryBand(percent: number): EducationalMasteryBand { return percent >= 90 ? "advanced" : percent >= 70 ? "proficient" : percent >= 50 ? "developing" : "emerging"; }
function validateCriterion(value: EducationalRubricCriterion): EducationalRubricCriterion {
  if (!value || typeof value !== "object") throw new Error("Invalid rubric criterion.");
  const weight = Number(value.weightPercent);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) throw new Error("Rubric criterion weight must be greater than 0 and at most 100.");
  return Object.freeze({ id: required(value.id, "Criterion id"), name: required(value.name, "Criterion name"), description: required(value.description, "Criterion description"), weightPercent: weight, learningObjective: required(value.learningObjective, "Criterion learning objective"), evidenceGuidance: required(value.evidenceGuidance, "Criterion evidence guidance") });
}
function validateLevel(value: EducationalRubricLevel): EducationalRubricLevel {
  if (!value || typeof value !== "object") throw new Error("Invalid rubric level.");
  const score = Number(value.score); if (!Number.isFinite(score)) throw new Error("Rubric level score must be finite.");
  return Object.freeze({ id: required(value.id, "Rubric level id"), label: required(value.label, "Rubric level label"), score, description: required(value.description, "Rubric level description") });
}
function uniqueModes(values: readonly EducationalResponseMode[]): EducationalResponseMode[] { const modes = [...new Set(values)]; for (const mode of modes) if (!EDUCATIONAL_RESPONSE_MODES.includes(mode)) throw new Error(`Unsupported educational response mode "${mode}".`); return modes; }
function uniqueIds(ids: readonly string[], label: string): void { if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${label} id.`); }
function uniqueStrings(values: readonly string[]): string[] { return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))]; }
function required(value: string, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function optional(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function iso(value: string, label: string): string { const parsed = new Date(value); if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} must be a valid timestamp.`); return parsed.toISOString(); }
