import { JOURNAL_CATEGORIES, validatePromptLibrary, type JournalCategory, type JournalPrompt } from "./guided-journal";
import { createGuidedJournalPromptPack, type GuidedJournalPromptPack } from "./guided-journal-packs";

export const GUIDED_JOURNAL_PERSONALIZATION_FORMAT_VERSION = 1 as const;
export const PERSONALIZATION_ALGORITHM_VERSION = "kings-questionnaire-v1" as const;

export const PERSONALIZATION_GOALS = [
  "gratitude",
  "self-discovery",
  "relationships",
  "confidence",
  "creativity",
  "habits",
  "purpose",
  "resilience",
  "planning",
  "mindfulness",
] as const;

export const REFLECTION_DEPTHS = ["gentle", "balanced", "deep"] as const;
export const JOURNEY_VARIETY_MODES = ["focused", "balanced", "exploratory"] as const;

export type PersonalizationGoal = typeof PERSONALIZATION_GOALS[number];
export type ReflectionDepth = typeof REFLECTION_DEPTHS[number];
export type JourneyVarietyMode = typeof JOURNEY_VARIETY_MODES[number];

export interface WeightedPersonalizationGoal {
  readonly goal: PersonalizationGoal;
  readonly weight: number;
}

export interface GuidedJournalPersonalizationQuestionnaire {
  readonly formatVersion: typeof GUIDED_JOURNAL_PERSONALIZATION_FORMAT_VERSION;
  readonly id: string;
  readonly goals: readonly WeightedPersonalizationGoal[];
  readonly preferredCategories?: readonly JournalCategory[];
  readonly preferredTags?: readonly string[];
  readonly blockedTags?: readonly string[];
  readonly reflectionDepth: ReflectionDepth;
  readonly variety: JourneyVarietyMode;
  readonly promptCount: number;
  readonly seed: string;
  readonly createdAt: string;
}

export interface CreateGuidedJournalPersonalizationQuestionnaireRequest {
  readonly id: string;
  readonly goals: readonly WeightedPersonalizationGoal[];
  readonly preferredCategories?: readonly JournalCategory[];
  readonly preferredTags?: readonly string[];
  readonly blockedTags?: readonly string[];
  readonly reflectionDepth?: ReflectionDepth;
  readonly variety?: JourneyVarietyMode;
  readonly promptCount: number;
  readonly seed: string;
  readonly now?: string;
}

export interface PersonalizedPromptEvidence {
  readonly promptId: string;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface GuidedJournalPersonalizationPlan {
  readonly formatVersion: typeof GUIDED_JOURNAL_PERSONALIZATION_FORMAT_VERSION;
  readonly algorithmVersion: typeof PERSONALIZATION_ALGORITHM_VERSION;
  readonly questionnaireId: string;
  readonly questionnaireFingerprint: string;
  readonly selectedPromptIds: readonly string[];
  readonly evidence: readonly PersonalizedPromptEvidence[];
}

export interface BuildPersonalizedPromptPackRequest {
  readonly packId: string;
  readonly title: string;
  readonly description?: string;
  readonly questionnaire: GuidedJournalPersonalizationQuestionnaire;
  readonly promptLibrary: readonly JournalPrompt[];
  readonly now?: string;
}

function goalCategories(...categories: JournalCategory[]): readonly JournalCategory[] {
  return Object.freeze(categories);
}

const GOAL_CATEGORY_AFFINITY: Readonly<Record<PersonalizationGoal, readonly JournalCategory[]>> = Object.freeze({
  gratitude: goalCategories("remember", "hope"),
  "self-discovery": goalCategories("discover", "become"),
  relationships: goalCategories("remember", "discover", "challenge"),
  confidence: goalCategories("become", "challenge", "hope"),
  creativity: goalCategories("create", "discover"),
  habits: goalCategories("become", "challenge"),
  purpose: goalCategories("discover", "become", "hope"),
  resilience: goalCategories("challenge", "hope", "become"),
  planning: goalCategories("create", "become", "challenge"),
  mindfulness: goalCategories("discover", "remember", "hope"),
});

export function createGuidedJournalPersonalizationQuestionnaire(
  request: CreateGuidedJournalPersonalizationQuestionnaireRequest,
): GuidedJournalPersonalizationQuestionnaire {
  const result: GuidedJournalPersonalizationQuestionnaire = Object.freeze({
    formatVersion: GUIDED_JOURNAL_PERSONALIZATION_FORMAT_VERSION,
    id: required(request.id, "Questionnaire id"),
    goals: Object.freeze(normalizeGoals(request.goals)),
    ...(request.preferredCategories?.length ? { preferredCategories: Object.freeze(uniqueCategories(request.preferredCategories)) } : {}),
    ...(request.preferredTags?.length ? { preferredTags: Object.freeze(uniqueStrings(request.preferredTags)) } : {}),
    ...(request.blockedTags?.length ? { blockedTags: Object.freeze(uniqueStrings(request.blockedTags)) } : {}),
    reflectionDepth: request.reflectionDepth ?? "balanced",
    variety: request.variety ?? "balanced",
    promptCount: positiveInteger(request.promptCount, "Personalized journey prompt count"),
    seed: required(request.seed, "Personalization seed"),
    createdAt: timestamp(request.now),
  });
  validateGuidedJournalPersonalizationQuestionnaire(result);
  return result;
}

export function buildGuidedJournalPersonalizationPlan(
  questionnaire: GuidedJournalPersonalizationQuestionnaire,
  promptLibrary: readonly JournalPrompt[],
): GuidedJournalPersonalizationPlan {
  validateGuidedJournalPersonalizationQuestionnaire(questionnaire);
  const library = validatePromptLibrary(promptLibrary).filter((prompt) => prompt.enabled);
  const blocked = new Set((questionnaire.blockedTags ?? []).map(normalizeTag));
  const eligible = library.filter((prompt) => !prompt.tags.some((tag) => blocked.has(normalizeTag(tag))));
  if (eligible.length < questionnaire.promptCount) {
    throw new Error(`Personalized journey requires ${questionnaire.promptCount} prompts but only ${eligible.length} are eligible after exclusions.`);
  }

  const scored = eligible.map((prompt) => scorePrompt(questionnaire, prompt));
  const selected = selectStrategically(questionnaire, scored);

  return Object.freeze({
    formatVersion: GUIDED_JOURNAL_PERSONALIZATION_FORMAT_VERSION,
    algorithmVersion: PERSONALIZATION_ALGORITHM_VERSION,
    questionnaireId: questionnaire.id,
    questionnaireFingerprint: questionnaireFingerprint(questionnaire),
    selectedPromptIds: Object.freeze(selected.map((item) => item.prompt.id)),
    evidence: Object.freeze(selected.map((item) => Object.freeze({
      promptId: item.prompt.id,
      score: item.score,
      reasons: Object.freeze([...item.reasons]),
    }))),
  });
}

export function buildPersonalizedGuidedJournalPromptPack(
  request: BuildPersonalizedPromptPackRequest,
): { readonly pack: GuidedJournalPromptPack; readonly plan: GuidedJournalPersonalizationPlan } {
  const plan = buildGuidedJournalPersonalizationPlan(request.questionnaire, request.promptLibrary);
  const pack = createGuidedJournalPromptPack({
    id: required(request.packId, "Personalized prompt pack id"),
    title: required(request.title, "Personalized prompt pack title"),
    ...(request.description?.trim() ? { description: request.description.trim() } : {}),
    mode: "ordered",
    source: "curated",
    tags: [
      "kings:personalized",
      `questionnaire:${request.questionnaire.id}`,
      `questionnaire-fingerprint:${plan.questionnaireFingerprint}`,
      `algorithm:${plan.algorithmVersion}`,
    ],
    promptIds: plan.selectedPromptIds,
    promptLibrary: request.promptLibrary,
    now: request.now,
  });
  return Object.freeze({ pack, plan });
}

export function validateGuidedJournalPersonalizationQuestionnaire(
  questionnaire: GuidedJournalPersonalizationQuestionnaire,
): void {
  if (questionnaire.formatVersion !== GUIDED_JOURNAL_PERSONALIZATION_FORMAT_VERSION) {
    throw new Error("Unsupported Guided Journal personalization questionnaire version.");
  }
  required(questionnaire.id, "Questionnaire id");
  normalizeGoals(questionnaire.goals);
  if (questionnaire.preferredCategories) uniqueCategories(questionnaire.preferredCategories);
  if (questionnaire.preferredTags) uniqueStrings(questionnaire.preferredTags);
  if (questionnaire.blockedTags) uniqueStrings(questionnaire.blockedTags);
  if (!REFLECTION_DEPTHS.includes(questionnaire.reflectionDepth)) throw new Error("Unsupported reflection depth.");
  if (!JOURNEY_VARIETY_MODES.includes(questionnaire.variety)) throw new Error("Unsupported journey variety mode.");
  positiveInteger(questionnaire.promptCount, "Personalized journey prompt count");
  required(questionnaire.seed, "Personalization seed");
  timestamp(questionnaire.createdAt);
}

export function questionnaireFingerprint(questionnaire: GuidedJournalPersonalizationQuestionnaire): string {
  validateGuidedJournalPersonalizationQuestionnaire(questionnaire);
  const canonical = JSON.stringify({
    formatVersion: questionnaire.formatVersion,
    id: questionnaire.id,
    goals: [...questionnaire.goals].sort((a, b) => a.goal.localeCompare(b.goal)),
    preferredCategories: [...(questionnaire.preferredCategories ?? [])].sort(),
    preferredTags: [...(questionnaire.preferredTags ?? [])].map(normalizeTag).sort(),
    blockedTags: [...(questionnaire.blockedTags ?? [])].map(normalizeTag).sort(),
    reflectionDepth: questionnaire.reflectionDepth,
    variety: questionnaire.variety,
    promptCount: questionnaire.promptCount,
    seed: questionnaire.seed,
  });
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

interface ScoredPrompt {
  readonly prompt: JournalPrompt;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly tieBreak: number;
}

function scorePrompt(questionnaire: GuidedJournalPersonalizationQuestionnaire, prompt: JournalPrompt): ScoredPrompt {
  let score = 0;
  const reasons: string[] = [];
  const tags = new Set(prompt.tags.map(normalizeTag));

  for (const item of questionnaire.goals) {
    if (GOAL_CATEGORY_AFFINITY[item.goal].includes(prompt.category)) {
      const value = item.weight * 6;
      score += value;
      reasons.push(`goal:${item.goal}+${value}`);
    }
    if (tags.has(`goal:${item.goal}`) || tags.has(item.goal)) {
      const value = item.weight * 10;
      score += value;
      reasons.push(`tag-goal:${item.goal}+${value}`);
    }
  }

  if (questionnaire.preferredCategories?.includes(prompt.category)) {
    score += 14;
    reasons.push(`preferred-category:${prompt.category}+14`);
  }

  for (const preferred of questionnaire.preferredTags ?? []) {
    const tag = normalizeTag(preferred);
    if (tags.has(tag)) {
      score += 12;
      reasons.push(`preferred-tag:${tag}+12`);
    }
  }

  const depthTag = `depth:${questionnaire.reflectionDepth}`;
  if (tags.has(depthTag)) {
    score += 8;
    reasons.push(`${depthTag}+8`);
  } else if (questionnaire.reflectionDepth === "balanced" && ![...tags].some((tag) => tag.startsWith("depth:"))) {
    score += 2;
    reasons.push("balanced-untagged+2");
  }

  const tieBreak = seededRank(`${questionnaire.seed}:${prompt.id}`);
  return Object.freeze({ prompt, score, reasons: Object.freeze(reasons), tieBreak });
}

function selectStrategically(questionnaire: GuidedJournalPersonalizationQuestionnaire, scored: readonly ScoredPrompt[]): ScoredPrompt[] {
  const ranked = [...scored].sort((a, b) => b.score - a.score || a.tieBreak - b.tieBreak || a.prompt.id.localeCompare(b.prompt.id));
  if (questionnaire.variety === "focused") return ranked.slice(0, questionnaire.promptCount);

  const buckets = new Map<JournalCategory, ScoredPrompt[]>();
  for (const category of JOURNAL_CATEGORIES) buckets.set(category, []);
  for (const item of ranked) buckets.get(item.prompt.category)!.push(item);

  const selected: ScoredPrompt[] = [];
  const selectedIds = new Set<string>();
  const preferredOrder = categoryOrder(questionnaire);
  const targetDistinctCategories = questionnaire.variety === "exploratory"
    ? Math.min(JOURNAL_CATEGORIES.length, questionnaire.promptCount)
    : Math.min(4, questionnaire.promptCount);

  for (const category of preferredOrder.slice(0, targetDistinctCategories)) {
    const candidate = buckets.get(category)?.find((item) => !selectedIds.has(item.prompt.id));
    if (candidate) {
      selected.push(candidate);
      selectedIds.add(candidate.prompt.id);
    }
  }

  for (const item of ranked) {
    if (selected.length >= questionnaire.promptCount) break;
    if (selectedIds.has(item.prompt.id)) continue;
    selected.push(item);
    selectedIds.add(item.prompt.id);
  }

  return selected;
}

function categoryOrder(questionnaire: GuidedJournalPersonalizationQuestionnaire): JournalCategory[] {
  const weights = new Map<JournalCategory, number>(JOURNAL_CATEGORIES.map((category) => [category, 0]));
  for (const item of questionnaire.goals) {
    for (const category of GOAL_CATEGORY_AFFINITY[item.goal]) {
      weights.set(category, (weights.get(category) ?? 0) + item.weight);
    }
  }
  for (const category of questionnaire.preferredCategories ?? []) {
    weights.set(category, (weights.get(category) ?? 0) + 10);
  }
  return [...JOURNAL_CATEGORIES].sort((a, b) => (weights.get(b) ?? 0) - (weights.get(a) ?? 0) || a.localeCompare(b));
}

function normalizeGoals(goals: readonly WeightedPersonalizationGoal[]): WeightedPersonalizationGoal[] {
  if (!Array.isArray(goals) || goals.length === 0) throw new Error("At least one personalization goal is required.");
  const seen = new Set<PersonalizationGoal>();
  return goals.map((item) => {
    if (!PERSONALIZATION_GOALS.includes(item.goal)) throw new Error(`Unsupported personalization goal "${item.goal}".`);
    if (seen.has(item.goal)) throw new Error(`Duplicate personalization goal "${item.goal}".`);
    seen.add(item.goal);
    if (!Number.isInteger(item.weight) || item.weight < 1 || item.weight > 5) throw new Error("Personalization goal weight must be an integer from 1 to 5.");
    return Object.freeze({ goal: item.goal, weight: item.weight });
  });
}

function uniqueCategories(values: readonly JournalCategory[]): JournalCategory[] {
  const result = [...new Set(values)];
  for (const value of result) if (!JOURNAL_CATEGORIES.includes(value)) throw new Error(`Unsupported journal category "${value}".`);
  return result;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function normalizeTag(value: string): string {
  return String(value).trim().toLowerCase();
}

function seededRank(seed: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += 0x6d2b79f5;
  let value = hash;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function timestamp(value = new Date().toISOString()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Timestamp must be valid ISO date/time.");
  return date.toISOString();
}
