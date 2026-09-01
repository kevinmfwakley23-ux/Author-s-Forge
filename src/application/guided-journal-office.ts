import {
  generateGuidedJournal,
  type GuidedJournalGenerationRequest,
  type GuidedJournalPlan,
} from "../domain/guided-journal";
import { FileGuidedJournalStore } from "../infrastructure/file-guided-journal-store";

export interface CreateGuidedJournalEditionRequest extends GuidedJournalGenerationRequest {
  readonly noRepeatAcrossEditions?: boolean;
}

/**
 * Application boundary for the Guided Journal Office.
 *
 * Editions are generated deterministically, then persisted. By default the
 * service excludes prompts already used by earlier editions in the same
 * project so a series can grow without accidental prompt repetition.
 */
export class GuidedJournalOfficeService {
  constructor(private readonly store: FileGuidedJournalStore) {}

  async createEdition(request: CreateGuidedJournalEditionRequest): Promise<GuidedJournalPlan> {
    const history = await this.store.list(request.projectId);
    const usedPromptIds = request.noRepeatAcrossEditions === false
      ? []
      : history.flatMap((journal) => journal.sourcePromptIds);

    const excluded = new Set([
      ...(request.pool?.excludedPromptIds ?? []),
      ...usedPromptIds,
    ]);

    const journal = generateGuidedJournal({
      ...request,
      pool: {
        ...(request.pool ?? {}),
        excludedPromptIds: [...excluded],
      },
    });

    await this.store.save(journal);
    return journal;
  }

  async listEditions(projectId: string): Promise<readonly GuidedJournalPlan[]> {
    return this.store.list(projectId);
  }

  async getEdition(projectId: string, journalId: string): Promise<GuidedJournalPlan | undefined> {
    return this.store.get(projectId, journalId);
  }
}
