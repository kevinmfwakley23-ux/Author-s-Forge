import {
  buildPersonalizedGuidedJournalPromptPack,
  type GuidedJournalPersonalizationPlan,
  type GuidedJournalPersonalizationQuestionnaire,
} from "../domain/guided-journal-personalization";
import { startGuidedJournalJourney, type GuidedJournalJourneyProgress } from "../domain/guided-journal-journey";
import type { GuidedJournalPromptPack } from "../domain/guided-journal-packs";
import type { JournalPrompt } from "../domain/guided-journal";

export interface CreatePersonalizedGuidedJourneyRequest {
  readonly projectId: string;
  readonly journeyId: string;
  readonly packId: string;
  readonly title: string;
  readonly description?: string;
  readonly journalId?: string;
  readonly questionnaire: GuidedJournalPersonalizationQuestionnaire;
  readonly promptLibrary: readonly JournalPrompt[];
  readonly now?: string;
}

export interface PersonalizedGuidedJourneyResult {
  readonly pack: GuidedJournalPromptPack;
  readonly journey: GuidedJournalJourneyProgress;
  readonly personalization: GuidedJournalPersonalizationPlan;
}

export function createPersonalizedGuidedJourney(
  request: CreatePersonalizedGuidedJourneyRequest,
): PersonalizedGuidedJourneyResult {
  const projectId = required(request.projectId, "Project id");
  const { pack, plan } = buildPersonalizedGuidedJournalPromptPack({
    packId: request.packId,
    title: request.title,
    description: request.description,
    questionnaire: request.questionnaire,
    promptLibrary: request.promptLibrary,
    now: request.now,
  });

  const journey = startGuidedJournalJourney({
    id: required(request.journeyId, "Journey id"),
    projectId,
    ...(request.journalId?.trim() ? { journalId: request.journalId.trim() } : {}),
    pack,
    seed: request.questionnaire.seed,
    now: request.now,
  });

  return Object.freeze({ pack, journey, personalization: plan });
}

function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
