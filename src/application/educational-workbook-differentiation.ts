import { EducationalWorkbookOfficeService } from "./educational-workbook-office";
import {
  createEducationalDifferentiationPack,
  defaultLearnerSupports,
  defaultTeacherNotes,
  differentiationDifficulty,
  EDUCATIONAL_DIFFERENTIATION_TIERS,
  type EducationalDifferentiationPack,
  type EducationalDifferentiationReadiness,
  type EducationalDifferentiationTier,
  type EducationalDifferentiationVariant,
} from "../domain/educational-workbook-differentiation";
import { WORKBOOK_GRADE_BANDS, WORKBOOK_SUBJECTS, type WorkbookActivity, type WorkbookGradeBand, type WorkbookSubject } from "../domain/educational-workbook";
import { FileEducationalWorkbookDifferentiationStore } from "../infrastructure/file-educational-workbook-differentiation-store";

export interface EducationalDifferentiationRequest {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly gradeBand: WorkbookGradeBand;
  readonly seed: string;
  readonly activityCountPerVariant: number;
  readonly learningObjectives: readonly string[];
  readonly directions?: readonly string[];
  readonly standards?: readonly string[];
  readonly tags?: readonly string[];
  readonly subjects?: readonly WorkbookSubject[];
  readonly includeAnswerKey?: boolean;
  readonly now?: string;
}

export interface EducationalDifferentiationReadinessRequest {
  readonly projectId: string;
  readonly gradeBand: WorkbookGradeBand;
  readonly activityCountPerVariant: number;
  readonly standards?: readonly string[];
  readonly tags?: readonly string[];
  readonly subjects?: readonly WorkbookSubject[];
}

export class EducationalWorkbookDifferentiationService {
  constructor(
    private readonly office: EducationalWorkbookOfficeService,
    private readonly store: FileEducationalWorkbookDifferentiationStore,
  ) {}

  async readiness(input: EducationalDifferentiationReadinessRequest): Promise<EducationalDifferentiationReadiness> {
    const projectId = required(input.projectId, "Project id");
    if (!WORKBOOK_GRADE_BANDS.includes(input.gradeBand)) throw new Error("Unsupported workbook grade band.");
    const requiredCount = count(input.activityCountPerVariant);
    const subjects = uniqueSubjects(input.subjects ?? []);
    const standards = uniqueStrings(input.standards ?? []);
    const tags = uniqueStrings(input.tags ?? []);
    const library = await this.office.listActivities(projectId);
    const base = library.filter((activity) => eligible(activity, input.gradeBand, subjects, standards, tags));
    const tiers = EDUCATIONAL_DIFFERENTIATION_TIERS.map((tier) => {
      const difficulty = differentiationDifficulty(tier);
      const eligibleActivityCount = base.filter((activity) => activity.difficulty === difficulty).length;
      return Object.freeze({ tier, difficulty, eligibleActivityCount, requiredActivityCount: requiredCount, ready: eligibleActivityCount >= requiredCount });
    });
    return Object.freeze({ projectId, gradeBand: input.gradeBand, requestedActivityCountPerVariant: requiredCount, tiers: Object.freeze(tiers), ready: tiers.every((tier) => tier.ready) });
  }

  async createPack(input: EducationalDifferentiationRequest): Promise<EducationalDifferentiationPack> {
    const projectId = required(input.projectId, "Project id");
    const id = required(input.id, "Differentiation pack id");
    const title = required(input.title, "Differentiation pack title");
    const seed = required(input.seed, "Differentiation seed");
    const learningObjectives = uniqueStrings(input.learningObjectives);
    if (!learningObjectives.length) throw new Error("Differentiation pack requires at least one learning objective.");
    const standards = uniqueStrings(input.standards ?? []);
    const tags = uniqueStrings(input.tags ?? []);
    const subjects = uniqueSubjects(input.subjects ?? []);
    const readiness = await this.readiness({ projectId, gradeBand: input.gradeBand, activityCountPerVariant: input.activityCountPerVariant, standards, tags, subjects });
    if (!readiness.ready) {
      const detail = readiness.tiers.map((tier) => `${tier.tier}/${tier.difficulty}: ${tier.eligibleActivityCount}/${tier.requiredActivityCount}`).join(", ");
      throw new Error(`Differentiation pack is not ready. Add or approve enough correctly classified activities first (${detail}).`);
    }
    const existingPack = await this.store.get(projectId, id);
    if (existingPack) throw new Error(`Duplicate Educational Workbook differentiation pack id "${id}".`);
    const existingWorkbooks = await this.office.listWorkbooks(projectId);
    const plannedIds = EDUCATIONAL_DIFFERENTIATION_TIERS.map((tier) => `${id}-${tier}`);
    const collisions = plannedIds.filter((workbookId) => existingWorkbooks.some((workbook) => workbook.id === workbookId));
    if (collisions.length) throw new Error(`Differentiation workbook id already exists: ${collisions.join(", ")}.`);

    const library = await this.office.listActivities(projectId);
    const base = library.filter((activity) => eligible(activity, input.gradeBand, subjects, standards, tags));
    const variants: EducationalDifferentiationVariant[] = [];
    for (const tier of EDUCATIONAL_DIFFERENTIATION_TIERS) {
      const difficulty = differentiationDifficulty(tier);
      const activityIds = base.filter((activity) => activity.difficulty === difficulty).map((activity) => activity.id);
      const learnerSupports = defaultLearnerSupports(tier);
      const teacherNotes = defaultTeacherNotes(tier);
      const workbook = await this.office.createWorkbook({
        id: `${id}-${tier}`,
        projectId,
        title: `${title} — ${label(tier)}`,
        subtitle: subtitleFor(tier),
        gradeBand: input.gradeBand,
        seed: `${seed}:${tier}`,
        activityCount: readiness.requestedActivityCountPerVariant,
        learningObjectives,
        directions: [...uniqueStrings(input.directions ?? []), ...studentDirections(tier)],
        includeAnswerKey: input.includeAnswerKey !== false,
        pool: { activityIds },
        ...(input.now ? { now: input.now } : {}),
      });
      variants.push(Object.freeze({ tier, label: label(tier), workbookId: workbook.id, difficulty, learnerSupports, teacherNotes }));
    }

    return this.store.save(createEducationalDifferentiationPack({
      id,
      projectId,
      title,
      gradeBand: input.gradeBand,
      learningObjectives,
      standards,
      tags,
      subjects,
      activityCountPerVariant: readiness.requestedActivityCountPerVariant,
      variants,
      ...(input.now ? { now: input.now } : {}),
    }));
  }

  async list(projectId: string): Promise<readonly EducationalDifferentiationPack[]> {
    return this.store.list(required(projectId, "Project id"));
  }

  async get(projectId: string, packId: string): Promise<EducationalDifferentiationPack | undefined> {
    return this.store.get(required(projectId, "Project id"), required(packId, "Differentiation pack id"));
  }
}

function eligible(activity: WorkbookActivity, gradeBand: WorkbookGradeBand, subjects: readonly WorkbookSubject[], standards: readonly string[], tags: readonly string[]): boolean {
  return activity.enabled && activity.gradeBands.includes(gradeBand) && (!subjects.length || subjects.includes(activity.subject)) && standards.every((standard) => activity.standards.includes(standard)) && tags.every((tag) => activity.tags.includes(tag));
}
function label(tier: EducationalDifferentiationTier): string {
  return tier === "support" ? "Supported Practice" : tier === "core" ? "Core Practice" : "Extension Challenge";
}
function subtitleFor(tier: EducationalDifferentiationTier): string {
  return tier === "support" ? "Intro-level practice with scaffold guidance" : tier === "core" ? "Grade-band core independent practice" : "Challenge-level reasoning and transfer practice";
}
function studentDirections(tier: EducationalDifferentiationTier): readonly string[] {
  if (tier === "support") return ["Complete one activity at a time. Ask for vocabulary, a worked example, oral response, or sentence-frame support when it helps you access the learning goal.", "Accuracy and understanding matter more than speed."];
  if (tier === "core") return ["Read the learning objective before beginning and show your thinking when response space is provided."];
  return ["Explain your reasoning when possible and connect the skill to a new example or context after completing each challenge."];
}
function uniqueSubjects(values: readonly WorkbookSubject[]): WorkbookSubject[] {
  const result = [...new Set(values)];
  for (const value of result) if (!WORKBOOK_SUBJECTS.includes(value)) throw new Error(`Unsupported workbook subject "${value}".`);
  return result;
}
function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}
function count(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 200) throw new Error("Differentiation activity count per variant must be an integer from 1 to 200.");
  return value;
}
function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
