export const EDUCATIONAL_WORKBOOK_FORMAT_VERSION = 1 as const;

export const WORKBOOK_GRADE_BANDS = ["pre-k", "k-2", "3-5", "6-8", "9-12", "adult"] as const;
export type WorkbookGradeBand = typeof WORKBOOK_GRADE_BANDS[number];

export const WORKBOOK_SUBJECTS = [
  "literacy",
  "math",
  "science",
  "social-studies",
  "handwriting",
  "social-emotional-learning",
  "language-learning",
  "test-prep",
  "custom",
] as const;
export type WorkbookSubject = typeof WORKBOOK_SUBJECTS[number];

export const WORKBOOK_ACTIVITY_KINDS = [
  "multiple-choice",
  "short-answer",
  "fill-in-blank",
  "true-false",
  "writing-prompt",
  "math-practice",
] as const;
export type WorkbookActivityKind = typeof WORKBOOK_ACTIVITY_KINDS[number];

export const WORKBOOK_DIFFICULTIES = ["intro", "practice", "challenge"] as const;
export type WorkbookDifficulty = typeof WORKBOOK_DIFFICULTIES[number];

export interface WorkbookActivity {
  readonly id: string;
  readonly projectId: string;
  readonly subject: WorkbookSubject;
  readonly gradeBands: readonly WorkbookGradeBand[];
  readonly kind: WorkbookActivityKind;
  readonly difficulty: WorkbookDifficulty;
  readonly prompt: string;
  readonly choices?: readonly string[];
  readonly answer?: string;
  readonly explanation?: string;
  readonly standards: readonly string[];
  readonly tags: readonly string[];
  readonly points: number;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkbookActivityInput {
  readonly id: string;
  readonly projectId: string;
  readonly subject: WorkbookSubject;
  readonly gradeBands: readonly WorkbookGradeBand[];
  readonly kind: WorkbookActivityKind;
  readonly difficulty?: WorkbookDifficulty;
  readonly prompt: string;
  readonly choices?: readonly string[];
  readonly answer?: string;
  readonly explanation?: string;
  readonly standards?: readonly string[];
  readonly tags?: readonly string[];
  readonly points?: number;
  readonly enabled?: boolean;
  readonly now?: string;
}

export interface WorkbookActivityPool {
  readonly subjects?: readonly WorkbookSubject[];
  readonly kinds?: readonly WorkbookActivityKind[];
  readonly standards?: readonly string[];
  readonly tags?: readonly string[];
  readonly activityIds?: readonly string[];
  readonly excludedActivityIds?: readonly string[];
}

export interface EducationalWorkbookGenerationRequest {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly gradeBand: WorkbookGradeBand;
  readonly seed: string;
  readonly activityCount: number;
  readonly activityLibrary: readonly WorkbookActivity[];
  readonly learningObjectives: readonly string[];
  readonly directions?: readonly string[];
  readonly pool?: WorkbookActivityPool;
  readonly includeAnswerKey?: boolean;
  readonly now?: string;
}

export interface EducationalWorkbookActivityPage {
  readonly sequence: number;
  readonly activityId: string;
  readonly subject: WorkbookSubject;
  readonly kind: WorkbookActivityKind;
  readonly difficulty: WorkbookDifficulty;
  readonly prompt: string;
  readonly choices?: readonly string[];
  readonly answer?: string;
  readonly explanation?: string;
  readonly standards: readonly string[];
  readonly tags: readonly string[];
  readonly points: number;
}

export interface EducationalWorkbookAnswerEntry {
  readonly sequence: number;
  readonly activityId: string;
  readonly answer: string;
  readonly explanation?: string;
  readonly points: number;
}

export interface EducationalWorkbookPlan {
  readonly formatVersion: typeof EDUCATIONAL_WORKBOOK_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly gradeBand: WorkbookGradeBand;
  readonly seed: string;
  readonly generatedAt: string;
  readonly learningObjectives: readonly string[];
  readonly directions: readonly string[];
  readonly includeAnswerKey: boolean;
  readonly activities: readonly EducationalWorkbookActivityPage[];
  readonly answerKey: readonly EducationalWorkbookAnswerEntry[];
  readonly subjectCounts: Readonly<Partial<Record<WorkbookSubject, number>>>;
  readonly totalPoints: number;
  readonly sourceActivityIds: readonly string[];
}

export function createWorkbookActivity(input: WorkbookActivityInput): WorkbookActivity {
  const now = iso(input.now ?? new Date().toISOString(), "Activity timestamp");
  const activity: WorkbookActivity = {
    id: required(input.id, "Activity id"),
    projectId: required(input.projectId, "Project id"),
    subject: input.subject,
    gradeBands: Object.freeze(uniqueGradeBands(input.gradeBands)),
    kind: input.kind,
    difficulty: input.difficulty ?? "practice",
    prompt: required(input.prompt, "Activity prompt"),
    ...(input.choices?.length ? { choices: Object.freeze(uniqueStrings(input.choices)) } : {}),
    ...(input.answer?.trim() ? { answer: input.answer.trim() } : {}),
    ...(input.explanation?.trim() ? { explanation: input.explanation.trim() } : {}),
    standards: Object.freeze(uniqueStrings(input.standards ?? [])),
    tags: Object.freeze(uniqueStrings(input.tags ?? [])),
    points: input.points ?? 1,
    enabled: input.enabled !== false,
    createdAt: now,
    updatedAt: now,
  };
  validateWorkbookActivity(activity);
  return Object.freeze(activity);
}

export function validateWorkbookActivity(activity: WorkbookActivity): void {
  required(activity.id, "Activity id");
  required(activity.projectId, "Project id");
  required(activity.prompt, "Activity prompt");
  if (!WORKBOOK_SUBJECTS.includes(activity.subject)) throw new Error(`Unsupported workbook subject "${activity.subject}".`);
  if (!WORKBOOK_ACTIVITY_KINDS.includes(activity.kind)) throw new Error(`Unsupported workbook activity kind "${activity.kind}".`);
  if (!WORKBOOK_DIFFICULTIES.includes(activity.difficulty)) throw new Error(`Unsupported workbook difficulty "${activity.difficulty}".`);
  if (!Array.isArray(activity.gradeBands) || !activity.gradeBands.length) throw new Error("Workbook activity requires at least one grade band.");
  if (new Set(activity.gradeBands).size !== activity.gradeBands.length) throw new Error(`Workbook activity "${activity.id}" contains duplicate grade bands.`);
  for (const band of activity.gradeBands) if (!WORKBOOK_GRADE_BANDS.includes(band)) throw new Error(`Unsupported workbook grade band "${band}".`);
  if (!Number.isInteger(activity.points) || activity.points < 0 || activity.points > 100) throw new Error("Workbook activity points must be an integer from 0 to 100.");
  const choices = activity.choices ?? [];
  if (activity.kind === "multiple-choice") {
    if (choices.length < 2) throw new Error(`Multiple-choice activity "${activity.id}" requires at least two choices.`);
    if (!activity.answer?.trim()) throw new Error(`Multiple-choice activity "${activity.id}" requires an answer.`);
    if (!choices.includes(activity.answer)) throw new Error(`Multiple-choice activity "${activity.id}" answer must exactly match one choice.`);
  } else if (choices.length) {
    throw new Error(`Only multiple-choice activities may define choices (activity "${activity.id}").`);
  }
  if (activity.kind === "true-false") {
    const answer = activity.answer?.trim().toLocaleLowerCase();
    if (answer !== "true" && answer !== "false") throw new Error(`True/false activity "${activity.id}" answer must be true or false.`);
  }
  if (requiresFixedAnswer(activity.kind) && !activity.answer?.trim()) throw new Error(`Workbook activity "${activity.id}" requires an answer.`);
  if (new Set(activity.standards).size !== activity.standards.length) throw new Error(`Workbook activity "${activity.id}" contains duplicate standards.`);
  if (new Set(activity.tags).size !== activity.tags.length) throw new Error(`Workbook activity "${activity.id}" contains duplicate tags.`);
  for (const value of [...activity.standards, ...activity.tags]) required(value, "Workbook activity metadata value");
  iso(activity.createdAt, "Activity createdAt");
  iso(activity.updatedAt, "Activity updatedAt");
  if (Date.parse(activity.updatedAt) < Date.parse(activity.createdAt)) throw new Error(`Workbook activity "${activity.id}" updatedAt predates createdAt.`);
}

export function validateWorkbookActivityLibrary(activities: readonly WorkbookActivity[]): readonly WorkbookActivity[] {
  if (!Array.isArray(activities) || !activities.length) throw new Error("Educational Workbook activity library cannot be empty.");
  const ids = new Set<string>();
  for (const activity of activities) {
    validateWorkbookActivity(activity);
    if (ids.has(activity.id)) throw new Error(`Duplicate workbook activity id "${activity.id}".`);
    ids.add(activity.id);
  }
  return activities;
}

export function generateEducationalWorkbook(request: EducationalWorkbookGenerationRequest): EducationalWorkbookPlan {
  const id = required(request.id, "Workbook id");
  const projectId = required(request.projectId, "Project id");
  const title = required(request.title, "Workbook title");
  const seed = required(request.seed, "Workbook seed");
  if (!WORKBOOK_GRADE_BANDS.includes(request.gradeBand)) throw new Error("Unsupported workbook grade band.");
  if (!Number.isInteger(request.activityCount) || request.activityCount < 1 || request.activityCount > 500) throw new Error("Workbook activity count must be an integer from 1 to 500.");
  const learningObjectives = uniqueStrings(request.learningObjectives);
  if (!learningObjectives.length) throw new Error("Educational Workbook requires at least one learning objective.");
  const directions = uniqueStrings(request.directions ?? []);
  const library = validateWorkbookActivityLibrary(request.activityLibrary);
  if (library.some((activity) => activity.projectId !== projectId)) throw new Error("Workbook activity library contains another project's activity.");

  const eligible = applyPool(library, request.gradeBand, request.pool);
  if (eligible.length < request.activityCount) throw new Error(`Workbook requires ${request.activityCount} unique activities but only ${eligible.length} are eligible.`);
  const random = seededRandom(seed);
  const selected = balancedSelection(eligible, request.activityCount, random);
  const subjectCounts: Partial<Record<WorkbookSubject, number>> = {};
  let totalPoints = 0;
  const activities = selected.map((activity, index): EducationalWorkbookActivityPage => {
    subjectCounts[activity.subject] = (subjectCounts[activity.subject] ?? 0) + 1;
    totalPoints += activity.points;
    return Object.freeze({
      sequence: index + 1,
      activityId: activity.id,
      subject: activity.subject,
      kind: activity.kind,
      difficulty: activity.difficulty,
      prompt: activity.prompt,
      ...(activity.choices ? { choices: Object.freeze([...activity.choices]) } : {}),
      ...(activity.answer ? { answer: activity.answer } : {}),
      ...(activity.explanation ? { explanation: activity.explanation } : {}),
      standards: Object.freeze([...activity.standards]),
      tags: Object.freeze([...activity.tags]),
      points: activity.points,
    });
  });
  const includeAnswerKey = request.includeAnswerKey !== false;
  const answerKey = includeAnswerKey
    ? activities.filter((activity) => Boolean(activity.answer?.trim())).map((activity): EducationalWorkbookAnswerEntry => Object.freeze({
        sequence: activity.sequence,
        activityId: activity.activityId,
        answer: activity.answer!,
        ...(activity.explanation ? { explanation: activity.explanation } : {}),
        points: activity.points,
      }))
    : [];
  const plan: EducationalWorkbookPlan = Object.freeze({
    formatVersion: EDUCATIONAL_WORKBOOK_FORMAT_VERSION,
    id,
    projectId,
    title,
    ...(request.subtitle?.trim() ? { subtitle: request.subtitle.trim() } : {}),
    gradeBand: request.gradeBand,
    seed,
    generatedAt: iso(request.now ?? new Date().toISOString(), "Workbook generatedAt"),
    learningObjectives: Object.freeze(learningObjectives),
    directions: Object.freeze(directions),
    includeAnswerKey,
    activities: Object.freeze(activities),
    answerKey: Object.freeze(answerKey),
    subjectCounts: Object.freeze({ ...subjectCounts }),
    totalPoints,
    sourceActivityIds: Object.freeze(activities.map((activity) => activity.activityId)),
  });
  validateEducationalWorkbookPlan(plan);
  return plan;
}

export function validateEducationalWorkbookPlan(plan: EducationalWorkbookPlan): void {
  if (plan.formatVersion !== EDUCATIONAL_WORKBOOK_FORMAT_VERSION) throw new Error("Unsupported Educational Workbook format.");
  required(plan.id, "Workbook id");
  required(plan.projectId, "Project id");
  required(plan.title, "Workbook title");
  required(plan.seed, "Workbook seed");
  if (!WORKBOOK_GRADE_BANDS.includes(plan.gradeBand)) throw new Error("Unsupported workbook grade band.");
  if (!plan.learningObjectives.length) throw new Error("Educational Workbook requires learning objectives.");
  if (!plan.activities.length) throw new Error("Educational Workbook requires activities.");
  if (plan.sourceActivityIds.length !== plan.activities.length || new Set(plan.sourceActivityIds).size !== plan.sourceActivityIds.length) throw new Error("Educational Workbook source activity ids are inconsistent.");
  if (plan.activities.some((activity, index) => activity.sequence !== index + 1 || activity.activityId !== plan.sourceActivityIds[index])) throw new Error("Educational Workbook activity sequence is inconsistent.");
  const computedPoints = plan.activities.reduce((sum, activity) => sum + activity.points, 0);
  if (computedPoints !== plan.totalPoints) throw new Error("Educational Workbook total points are inconsistent.");
  if (!plan.includeAnswerKey && plan.answerKey.length) throw new Error("Workbook without answer key cannot contain answer entries.");
  if (plan.answerKey.some((entry) => !plan.activities.some((activity) => activity.activityId === entry.activityId && activity.sequence === entry.sequence))) throw new Error("Educational Workbook answer key references an unknown activity.");
  iso(plan.generatedAt, "Workbook generatedAt");
}

function applyPool(library: readonly WorkbookActivity[], gradeBand: WorkbookGradeBand, pool?: WorkbookActivityPool): WorkbookActivity[] {
  const subjects = pool?.subjects?.length ? new Set(pool.subjects) : undefined;
  const kinds = pool?.kinds?.length ? new Set(pool.kinds) : undefined;
  const standards = pool?.standards?.length ? new Set(uniqueStrings(pool.standards)) : undefined;
  const tags = pool?.tags?.length ? new Set(uniqueStrings(pool.tags)) : undefined;
  const activityIds = pool?.activityIds?.length ? new Set(uniqueStrings(pool.activityIds)) : undefined;
  const excluded = new Set(uniqueStrings(pool?.excludedActivityIds ?? []));
  if (subjects) for (const subject of subjects) if (!WORKBOOK_SUBJECTS.includes(subject)) throw new Error(`Invalid workbook subject filter "${subject}".`);
  if (kinds) for (const kind of kinds) if (!WORKBOOK_ACTIVITY_KINDS.includes(kind)) throw new Error(`Invalid workbook activity-kind filter "${kind}".`);
  if (activityIds) {
    const known = new Set(library.map((activity) => activity.id));
    for (const id of activityIds) if (!known.has(id)) throw new Error(`Workbook pool references missing activity "${id}".`);
  }
  return library.filter((activity) =>
    activity.enabled &&
    activity.gradeBands.includes(gradeBand) &&
    !excluded.has(activity.id) &&
    (!activityIds || activityIds.has(activity.id)) &&
    (!subjects || subjects.has(activity.subject)) &&
    (!kinds || kinds.has(activity.kind)) &&
    (!standards || [...standards].every((standard) => activity.standards.includes(standard))) &&
    (!tags || [...tags].every((tag) => activity.tags.includes(tag)))
  );
}

function balancedSelection(eligible: readonly WorkbookActivity[], count: number, random: () => number): WorkbookActivity[] {
  const subjects = [...new Set(eligible.map((activity) => activity.subject))].sort();
  const buckets = new Map<WorkbookSubject, WorkbookActivity[]>();
  for (const subject of subjects) buckets.set(subject, []);
  for (const activity of eligible) buckets.get(activity.subject)!.push(activity);
  for (const bucket of buckets.values()) shuffle(bucket, random);
  shuffle(subjects, random);
  const selected: WorkbookActivity[] = [];
  while (selected.length < count) {
    let tookOne = false;
    for (const subject of subjects) {
      const bucket = buckets.get(subject)!;
      if (!bucket.length) continue;
      selected.push(bucket.shift()!);
      tookOne = true;
      if (selected.length === count) break;
    }
    if (!tookOne) break;
  }
  if (selected.length !== count) throw new Error("Unable to select enough unique workbook activities.");
  return selected;
}

function requiresFixedAnswer(kind: WorkbookActivityKind): boolean {
  return kind === "multiple-choice" || kind === "short-answer" || kind === "fill-in-blank" || kind === "true-false" || kind === "math-practice";
}

function uniqueGradeBands(values: readonly WorkbookGradeBand[]): WorkbookGradeBand[] {
  const bands = [...new Set(values)];
  if (!bands.length) throw new Error("Workbook activity requires at least one grade band.");
  for (const band of bands) if (!WORKBOOK_GRADE_BANDS.includes(band)) throw new Error(`Unsupported workbook grade band "${band}".`);
  return bands;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function shuffle<T>(items: T[], random: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function seededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
