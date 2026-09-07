import type { JournalPrompt } from "../domain/guided-journal";
import {
  completeGuidedJournalJourneyPrompt,
  guidedJournalJourneyStatus,
  hideGuidedJournalJourneyPrompt,
  nextGuidedJournalJourneyPrompt,
  reopenGuidedJournalJourneyPrompt,
  startGuidedJournalJourney,
  unhideGuidedJournalJourneyPrompt,
  type GuidedJournalJourneyProgress,
} from "../domain/guided-journal-journey";
import {
  createGuidedJournalPromptPack,
  reviseGuidedJournalPromptPack,
  type CreateGuidedJournalPromptPackRequest,
  type GuidedJournalPromptPack,
  type ReviseGuidedJournalPromptPackRequest,
} from "../domain/guided-journal-packs";
import { FileGuidedJournalJourneyStore } from "../infrastructure/file-guided-journal-journey-store";

export class GuidedJournalJourneyService {
  constructor(private readonly store: FileGuidedJournalJourneyStore) {}

  async createPack(request: CreateGuidedJournalPromptPackRequest): Promise<GuidedJournalPromptPack> {
    return this.store.savePack(createGuidedJournalPromptPack(request));
  }

  async revisePack(request: Omit<ReviseGuidedJournalPromptPackRequest, "previous"> & { readonly projectId: string; readonly packId: string }): Promise<GuidedJournalPromptPack> {
    const previous = await this.requirePack(request.projectId, request.packId);
    return this.store.savePack(reviseGuidedJournalPromptPack({ ...request, previous }));
  }

  async getPack(projectId: string, packId: string, version?: number): Promise<GuidedJournalPromptPack | undefined> {
    return this.store.getPack(projectId, packId, version);
  }

  async listPacks(projectId: string): Promise<readonly GuidedJournalPromptPack[]> {
    return this.store.listLatestPacks(projectId);
  }

  async start(input: {
    readonly id: string;
    readonly projectId: string;
    readonly packId: string;
    readonly packVersion?: number;
    readonly journalId?: string;
    readonly seed?: string;
    readonly now?: string;
  }): Promise<GuidedJournalJourneyProgress> {
    const pack = await this.requirePack(input.projectId, input.packId, input.packVersion);
    const progress = startGuidedJournalJourney({ ...input, pack });
    if (await this.store.getJourney(progress.projectId, progress.id)) throw new Error(`Guided journey "${progress.id}" already exists in project "${progress.projectId}".`);
    return this.store.saveJourney(progress);
  }

  async complete(projectId: string, journeyId: string, promptId: string, now?: string): Promise<GuidedJournalJourneyProgress> {
    const { progress, pack } = await this.context(projectId, journeyId);
    return this.store.saveJourney(completeGuidedJournalJourneyPrompt(progress, pack, promptId, now));
  }

  async reopen(projectId: string, journeyId: string, promptId: string, now?: string): Promise<GuidedJournalJourneyProgress> {
    const { progress, pack } = await this.context(projectId, journeyId);
    return this.store.saveJourney(reopenGuidedJournalJourneyPrompt(progress, pack, promptId, now));
  }

  async hide(projectId: string, journeyId: string, promptId: string, now?: string): Promise<GuidedJournalJourneyProgress> {
    const { progress, pack } = await this.context(projectId, journeyId);
    return this.store.saveJourney(hideGuidedJournalJourneyPrompt(progress, pack, promptId, now));
  }

  async unhide(projectId: string, journeyId: string, promptId: string, now?: string): Promise<GuidedJournalJourneyProgress> {
    const { progress, pack } = await this.context(projectId, journeyId);
    return this.store.saveJourney(unhideGuidedJournalJourneyPrompt(progress, pack, promptId, now));
  }

  async next(projectId: string, journeyId: string): Promise<JournalPrompt | undefined> {
    const { progress, pack } = await this.context(projectId, journeyId);
    return nextGuidedJournalJourneyPrompt(progress, pack);
  }

  async status(projectId: string, journeyId: string) {
    const progress = await this.requireJourney(projectId, journeyId);
    return guidedJournalJourneyStatus(progress);
  }

  async getJourney(projectId: string, journeyId: string): Promise<GuidedJournalJourneyProgress | undefined> {
    return this.store.getJourney(projectId, journeyId);
  }

  async listJourneys(projectId: string): Promise<readonly GuidedJournalJourneyProgress[]> {
    return this.store.listJourneys(projectId);
  }

  private async context(projectId: string, journeyId: string): Promise<{ progress: GuidedJournalJourneyProgress; pack: GuidedJournalPromptPack }> {
    const progress = await this.requireJourney(projectId, journeyId);
    const pack = await this.requirePack(projectId, progress.packId, progress.packVersion);
    return { progress, pack };
  }

  private async requirePack(projectId: string, packId: string, version?: number): Promise<GuidedJournalPromptPack> {
    const pack = await this.store.getPack(projectId, packId, version);
    if (!pack) throw new Error(version === undefined ? `Prompt pack "${packId}" not found in project "${projectId}".` : `Prompt pack "${packId}" version ${version} not found in project "${projectId}".`);
    return pack;
  }

  private async requireJourney(projectId: string, journeyId: string): Promise<GuidedJournalJourneyProgress> {
    const journey = await this.store.getJourney(projectId, journeyId);
    if (!journey) throw new Error(`Guided journey "${journeyId}" not found in project "${projectId}".`);
    return journey;
  }
}
