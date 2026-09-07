import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { GuidedJournalJourneyService } from "./guided-journal-guided-journeys";
import { createPersonalizedGuidedJourney } from "./guided-journal-personalized-journeys";
import type { GuidedJournalLibraryService } from "./guided-journal-library";
import {
  JOURNAL_CATEGORIES,
  type JournalCategory,
} from "../domain/guided-journal";
import {
  PROMPT_PACK_MODES,
  PROMPT_PACK_SOURCES,
  type PromptPackMode,
  type PromptPackSource,
} from "../domain/guided-journal-packs";
import {
  JOURNEY_VARIETY_MODES,
  PERSONALIZATION_GOALS,
  REFLECTION_DEPTHS,
  createGuidedJournalPersonalizationQuestionnaire,
  type JourneyVarietyMode,
  type PersonalizationGoal,
  type ReflectionDepth,
  type WeightedPersonalizationGoal,
} from "../domain/guided-journal-personalization";
import { FileGuidedJournalJourneyStore } from "../infrastructure/file-guided-journal-journey-store";

export interface GuidedJournalJourneyHttpHandler {
  (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string): Promise<boolean>;
}

export function createGuidedJournalJourneyHttpHandler(input: {
  readonly dataRoot: string;
  readonly library: GuidedJournalLibraryService;
}): GuidedJournalJourneyHttpHandler {
  const store = new FileGuidedJournalJourneyStore(join(input.dataRoot, "guided-journal-journeys.json"));
  const journeys = new GuidedJournalJourneyService(store);

  return async (req, res, url, projectId): Promise<boolean> => {
    const base = `/api/projects/${projectId}/journal`;

    if (url.pathname === `${base}/journey-packs` && req.method === "GET") {
      json(res, 200, await journeys.listPacks());
      return true;
    }

    if (url.pathname === `${base}/journey-packs` && req.method === "POST") {
      const value = await body(req);
      const library = await input.library.get(projectId);
      const pack = await journeys.createPack({
        id: required(value.id, "Prompt pack id"),
        title: required(value.title, "Prompt pack title"),
        ...(optional(value.description) ? { description: optional(value.description)! } : {}),
        mode: promptPackMode(value.mode),
        source: promptPackSource(value.source),
        tags: strings(value.tags),
        promptIds: strings(value.promptIds),
        promptLibrary: library.prompts,
      });
      json(res, 201, pack);
      return true;
    }

    const packRevision = url.pathname.match(new RegExp(`^${escapeRegex(base)}/journey-packs/([^/]+)/revise$`));
    if (packRevision && req.method === "POST") {
      const value = await body(req);
      const library = await input.library.get(projectId);
      const pack = await journeys.revisePack({
        packId: decodeURIComponent(packRevision[1]),
        ...(optional(value.title) ? { title: optional(value.title)! } : {}),
        ...(value.description !== undefined ? { description: optional(value.description) } : {}),
        ...(value.mode !== undefined ? { mode: promptPackMode(value.mode) } : {}),
        ...(value.source !== undefined ? { source: promptPackSource(value.source) } : {}),
        ...(Array.isArray(value.tags) ? { tags: strings(value.tags) } : {}),
        ...(Array.isArray(value.promptIds) ? { promptIds: strings(value.promptIds) } : {}),
        promptLibrary: library.prompts,
      });
      json(res, 200, pack);
      return true;
    }

    if (url.pathname === `${base}/journeys` && req.method === "GET") {
      json(res, 200, await journeys.listJourneys(projectId));
      return true;
    }

    if (url.pathname === `${base}/journeys` && req.method === "POST") {
      const value = await body(req);
      const progress = await journeys.start({
        id: required(value.id, "Journey id"),
        projectId,
        packId: required(value.packId, "Prompt pack id"),
        ...(positiveIntegerOptional(value.packVersion, "Prompt pack version") !== undefined ? { packVersion: positiveIntegerOptional(value.packVersion, "Prompt pack version") } : {}),
        ...(optional(value.journalId) ? { journalId: optional(value.journalId)! } : {}),
        ...(optional(value.seed) ? { seed: optional(value.seed)! } : {}),
      });
      json(res, 201, { progress, status: await journeys.status(progress.id), next: await journeys.next(progress.id) });
      return true;
    }

    if (url.pathname === `${base}/journeys/personalized` && req.method === "POST") {
      const value = await body(req);
      const library = await input.library.get(projectId);
      const questionnaireInput = object(value.questionnaire, "Personalization questionnaire");
      const questionnaire = createGuidedJournalPersonalizationQuestionnaire({
        id: required(questionnaireInput.id, "Questionnaire id"),
        goals: personalizationGoals(questionnaireInput.goals),
        ...(Array.isArray(questionnaireInput.preferredCategories) ? { preferredCategories: categories(questionnaireInput.preferredCategories) } : {}),
        ...(Array.isArray(questionnaireInput.preferredTags) ? { preferredTags: strings(questionnaireInput.preferredTags) } : {}),
        ...(Array.isArray(questionnaireInput.blockedTags) ? { blockedTags: strings(questionnaireInput.blockedTags) } : {}),
        reflectionDepth: reflectionDepth(questionnaireInput.reflectionDepth),
        variety: varietyMode(questionnaireInput.variety),
        promptCount: positiveInteger(questionnaireInput.promptCount, "Personalized journey prompt count"),
        seed: required(questionnaireInput.seed, "Personalization seed"),
      });
      const personalized = createPersonalizedGuidedJourney({
        projectId,
        journeyId: required(value.journeyId, "Journey id"),
        packId: required(value.packId, "Prompt pack id"),
        title: required(value.title, "Personalized journey title"),
        ...(optional(value.description) ? { description: optional(value.description)! } : {}),
        ...(optional(value.journalId) ? { journalId: optional(value.journalId)! } : {}),
        questionnaire,
        promptLibrary: library.prompts,
      });
      await store.savePack(personalized.pack);
      if (await store.getJourney(personalized.journey.id)) throw new Error(`Guided journey "${personalized.journey.id}" already exists.`);
      await store.saveJourney(personalized.journey);
      json(res, 201, {
        ...personalized,
        status: await journeys.status(personalized.journey.id),
        next: await journeys.next(personalized.journey.id),
      });
      return true;
    }

    const journeyMatch = url.pathname.match(new RegExp(`^${escapeRegex(base)}/journeys/([^/]+)$`));
    if (journeyMatch && req.method === "GET") {
      const journeyId = decodeURIComponent(journeyMatch[1]);
      const progress = await journeys.getJourney(journeyId);
      if (!progress || progress.projectId !== projectId) {
        json(res, 404, { error: "Guided journey not found." });
        return true;
      }
      json(res, 200, { progress, status: await journeys.status(journeyId), next: await journeys.next(journeyId) });
      return true;
    }

    const actionMatch = url.pathname.match(new RegExp(`^${escapeRegex(base)}/journeys/([^/]+)/(complete|reopen|hide|unhide)$`));
    if (actionMatch && req.method === "POST") {
      const journeyId = decodeURIComponent(actionMatch[1]);
      const existing = await journeys.getJourney(journeyId);
      if (!existing || existing.projectId !== projectId) {
        json(res, 404, { error: "Guided journey not found." });
        return true;
      }
      const value = await body(req);
      const promptId = required(value.promptId, "Prompt id");
      const action = actionMatch[2];
      const progress = action === "complete" ? await journeys.complete(journeyId, promptId)
        : action === "reopen" ? await journeys.reopen(journeyId, promptId)
          : action === "hide" ? await journeys.hide(journeyId, promptId)
            : await journeys.unhide(journeyId, promptId);
      json(res, 200, { progress, status: await journeys.status(journeyId), next: await journeys.next(journeyId) });
      return true;
    }

    return false;
  };
}

function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 2 * 1024 * 1024) throw new Error("Journey request body exceeds 2 MiB limit.");
  }
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  return object(parsed, "JSON request body");
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optional(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

function categories(value: unknown): JournalCategory[] {
  const result = strings(value);
  for (const category of result) if (!JOURNAL_CATEGORIES.includes(category as JournalCategory)) throw new Error(`Unsupported journal category "${category}".`);
  return result as JournalCategory[];
}

function promptPackMode(value: unknown): PromptPackMode {
  const candidate = value === undefined ? "ordered" : value;
  if (typeof candidate !== "string" || !PROMPT_PACK_MODES.includes(candidate as PromptPackMode)) throw new Error("Unsupported prompt pack mode.");
  return candidate as PromptPackMode;
}

function promptPackSource(value: unknown): PromptPackSource {
  const candidate = value === undefined ? "user" : value;
  if (typeof candidate !== "string" || !PROMPT_PACK_SOURCES.includes(candidate as PromptPackSource)) throw new Error("Unsupported prompt pack source.");
  return candidate as PromptPackSource;
}

function reflectionDepth(value: unknown): ReflectionDepth {
  const candidate = value === undefined ? "balanced" : value;
  if (typeof candidate !== "string" || !REFLECTION_DEPTHS.includes(candidate as ReflectionDepth)) throw new Error("Unsupported reflection depth.");
  return candidate as ReflectionDepth;
}

function varietyMode(value: unknown): JourneyVarietyMode {
  const candidate = value === undefined ? "balanced" : value;
  if (typeof candidate !== "string" || !JOURNEY_VARIETY_MODES.includes(candidate as JourneyVarietyMode)) throw new Error("Unsupported journey variety mode.");
  return candidate as JourneyVarietyMode;
}

function personalizationGoals(value: unknown): WeightedPersonalizationGoal[] {
  if (!Array.isArray(value) || !value.length) throw new Error("At least one personalization goal is required.");
  return value.map((entry) => {
    const item = object(entry, "Personalization goal");
    if (typeof item.goal !== "string" || !PERSONALIZATION_GOALS.includes(item.goal as PersonalizationGoal)) throw new Error("Unsupported personalization goal.");
    return { goal: item.goal as PersonalizationGoal, weight: positiveInteger(item.weight, "Personalization goal weight") };
  });
}

function positiveInteger(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function positiveIntegerOptional(value: unknown, label: string): number | undefined {
  return value === undefined || value === null || value === "" ? undefined : positiveInteger(value, label);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
