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

  async revisePack(request: Omit<ReviseGuidedJournalPromptPackRequest, "previous"> & { readonly packId: string }): Promise<GuidedJournalPromptPack> {
    const previous = await this.requirePack(request.packId);
    return this.store.savePack(reviseGuidedJournalPromptPack({ ...request, previous }));
  }

  async getPack(packId: string, version?: number): Promise<GuidedJournalPromptPack | undefined> {
    return this.store.getPack(packId, version);
  }

  async listPacks(): Promise<readonly GuidedJournalPromptPack[]> {
    return this.store.listLatestPacks();
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
    const pack = await this.requirePack(input.packId, input.packVersion);
    const progress = startGuidedJournalJourney({ ...input, pack });
    if (await this.store.getJourney(progress.id)) throw new Error(`Guided journey "${progress.id}" already exists.`);
    return this.store.saveJourney(progress);
  }

  async complete(journeyId: string, promptId: string, now?: string): Promise<GuidedJournalJourneyProgress> {
    const { progress, pack } = await this.context(journeyId);
    return this.store.saveJourney(completeGuidedJournalJourneyPrompt(progress, pack, promptId, now));
  }

  async reopen(journeyId: string, promptId: string, now?: string): Promise<GuidedJournalJourneyProgress> {
    const { progress, pack } = await this.context(journeyId);
    return this.store.saveJourney(reopenGuidedJournalJourneyPrompt(progress, pack, promptId, now));
  }

  async hide(journeyId: string, promptId: string, now?: string): Promise<GuidedJournalJourneyProgress> {
    const { progress, pack } = await this.context(journeyId);
    return this.store.saveJourney(hideGuidedJournalJourneyPrompt(progress, pack, promptId, now));
  }

  async unhide(journeyId: string, promptId: string, now?: string): Promise<GuidedJournalJourneyProgress> {
    const { progress, pack } = await this.context(journeyId);
    return this.store.saveJourney(unhideGuidedJournalJourneyPrompt(progress, pack, promptId, now));
  }

  async next(journeyId: string): Promise<JournalPrompt | undefined> {
    const { progress, pack } = await this.context(journeyId);
    return nextGuidedJournalJourneyPrompt(progress, pack);
  }

  async status(journeyId: string) {
    const progress = await this.requireJourney(journeyId);
    return guidedJournalJourneyStatus(progress);
  }

  async getJourney(journeyId: string): Promise<GuidedJournalJourneyProgress | undefined> {
    return this.store.getJourney(journeyId);
  }

  async listJourneys(projectId: string): Promise<readonly GuidedJournalJourneyProgress[]> {
    return this.store.listJourneys(projectId);
  }

  private async context(journeyId: string): Promise<{ progress: GuidedJournalJourneyProgress; pack: GuidedJournalPromptPack }> {
    const progress = await this.requireJourney(journeyId);
    const pack = await this.requirePack(progress.packId, progress.packVersion);
    return { progress, pack };
  }

  private async requirePack(packId: string, version?: number): Promise<GuidedJournalPromptPack> {
    const pack = await this.store.getPack(packId, version);
    if (!pack) throw new Error(version === undefined ? `Prompt pack "${packId}" not found.` : `Prompt pack "${packId}" version ${version} not found.`);
    return pack;
  }

  private async requireJourney(journeyId: string): Promise<GuidedJournalJourneyProgress> {
    const journey = await this.store.getJourney(journeyId);
    if (!journey) throw new Error(`Guided journey "${journeyId}" not found.`);
    return journey;
  }
}
