import { randomUUID } from "node:crypto";
import { createMemoryRecord, type MemoryRecord } from "../domain/memory";
import {
  approveMarketingAsset,
  createMarketingCampaign,
  publishMarketingAsset,
  rejectMarketingAsset,
  scheduleMarketingAsset,
  type MarketingCampaign,
} from "../domain/marketing-campaign";
import { withProjectMemories, type ProjectState } from "../domain/project";
import { getBook, validateStudioWorkspace } from "../domain/studio-workspace";
import { FileProjectStore } from "../infrastructure/file-project-store";

export interface MarketingCampaignState {
  readonly campaign: MarketingCampaign;
  readonly memoryId: string;
}

export class StudioMarketingCampaignService {
  public constructor(private readonly store: FileProjectStore) {}

  public async save(
    projectId: string,
    bookId: string,
    campaignInput: MarketingCampaign,
    options: { readonly now?: string; readonly memoryId?: string; readonly reference?: string } = {},
  ): Promise<MarketingCampaignState> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    const now = monotonicTimestamp(project, options.now, campaignInput.createdAt, campaignInput.updatedAt);
    const campaign = createMarketingCampaign({
      ...campaignInput,
      projectId,
      bookId,
      createdAt: campaignInput.createdAt ?? now,
      updatedAt: now,
    });
    const prior = this.records(project, bookId, campaign.id).filter((record) => record.authority !== "archived" && record.authority !== "superseded");
    const priorIds = new Set(prior.map((record) => record.id));
    const memories = project.memories.map((record) => priorIds.has(record.id) ? { ...record, authority: "archived" as const, updatedAt: now } : record);
    const memory = createMemoryRecord({
      id: options.memoryId ?? `marketing-campaign-${campaign.id}-${randomUUID()}`,
      projectId,
      class: "marketing-memory",
      authority: "working",
      summary: `Promotion campaign: ${campaign.objective}`,
      content: JSON.stringify(campaign, null, 2),
      provenance: [{ kind: "author", reference: options.reference?.trim() || "promotion-office", recordedAt: now }],
      relatedMemoryIds: [],
      relevanceTags: ["marketing-campaign", `book:${bookId}`, `campaign:${campaign.id}`],
      now,
    });
    await this.store.save(withProjectMemories(project, [...memories, memory], now));
    return { campaign, memoryId: memory.id };
  }

  public async list(projectId: string, bookId: string): Promise<readonly MarketingCampaignState[]> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    const active = project.memories
      .filter((record) => record.class === "marketing-memory" && record.relevanceTags.includes("marketing-campaign") && record.relevanceTags.includes(`book:${bookId}`) && record.authority !== "archived" && record.authority !== "superseded")
      .sort(newestCampaignRecordFirst);
    return active.map((record) => ({ campaign: this.parse(record, projectId, bookId), memoryId: record.id }));
  }

  public async get(projectId: string, bookId: string, campaignId: string): Promise<MarketingCampaignState> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    const id = required(campaignId, "Campaign id");
    const record = this.records(project, bookId, id)
      .filter((item) => item.authority !== "archived" && item.authority !== "superseded")
      .sort(newestCampaignRecordFirst)[0];
    if (!record) throw new Error(`Marketing campaign "${id}" was not found.`);
    return { campaign: this.parse(record, projectId, bookId), memoryId: record.id };
  }

  public async history(projectId: string, bookId: string, campaignId: string): Promise<readonly MarketingCampaignState[]> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    const id = required(campaignId, "Campaign id");
    return this.records(project, bookId, id)
      .sort(newestCampaignRecordFirst)
      .map((record) => ({ campaign: this.parse(record, projectId, bookId), memoryId: record.id }));
  }

  public async approveAsset(projectId: string, bookId: string, campaignId: string, assetId: string, now?: string): Promise<MarketingCampaignState> {
    const current = await this.get(projectId, bookId, campaignId);
    return this.save(projectId, bookId, approveMarketingAsset(current.campaign, required(assetId, "Marketing asset id"), now), { now, reference: `promotion-approval:${assetId}` });
  }

  public async rejectAsset(projectId: string, bookId: string, campaignId: string, assetId: string, now?: string): Promise<MarketingCampaignState> {
    const current = await this.get(projectId, bookId, campaignId);
    return this.save(projectId, bookId, rejectMarketingAsset(current.campaign, required(assetId, "Marketing asset id"), now), { now, reference: `promotion-rejection:${assetId}` });
  }

  public async scheduleAsset(projectId: string, bookId: string, campaignId: string, assetId: string, when: string, now?: string): Promise<MarketingCampaignState> {
    const current = await this.get(projectId, bookId, campaignId);
    return this.save(projectId, bookId, scheduleMarketingAsset(current.campaign, required(assetId, "Marketing asset id"), required(when, "Marketing schedule time"), now), { now, reference: `promotion-schedule:${assetId}` });
  }

  public async publishAsset(
    projectId: string,
    bookId: string,
    campaignId: string,
    assetId: string,
    input: { readonly authorApproved: boolean; readonly now?: string; readonly externalReference?: string },
  ): Promise<MarketingCampaignState> {
    if (input.authorApproved !== true) throw new Error("Explicit author approval is required before marking a marketing asset published.");
    const current = await this.get(projectId, bookId, campaignId);
    return this.save(projectId, bookId, publishMarketingAsset(current.campaign, required(assetId, "Marketing asset id"), { now: input.now, externalReference: input.externalReference }), { now: input.now, reference: `promotion-published:${assetId}` });
  }

  private records(project: ProjectState, bookId: string, campaignId: string): MemoryRecord[] {
    return project.memories.filter((record) => record.class === "marketing-memory" && record.relevanceTags.includes("marketing-campaign") && record.relevanceTags.includes(`book:${bookId}`) && record.relevanceTags.includes(`campaign:${campaignId}`));
  }

  private parse(record: MemoryRecord, projectId: string, bookId: string): MarketingCampaign {
    let parsed: unknown;
    try { parsed = JSON.parse(record.content); } catch { throw new Error(`Marketing campaign memory "${record.id}" contains invalid JSON.`); }
    const campaign = createMarketingCampaign(parsed as MarketingCampaign);
    if (campaign.projectId !== projectId || campaign.bookId !== bookId) throw new Error("Marketing campaign memory belongs to another project or book.");
    return campaign;
  }

  private async load(projectId: string): Promise<ProjectState> {
    const id = required(projectId, "Project id");
    const project = await this.store.load(id);
    if (!project) throw new Error(`Project "${id}" was not found.`);
    return project;
  }

  private requireBook(project: ProjectState, bookId: string) {
    if (!project.studioWorkspace) throw new Error("Project has no Studio workspace.");
    return getBook(validateStudioWorkspace(project.studioWorkspace), required(bookId, "Book id"));
  }
}

function newestCampaignRecordFirst(left: MemoryRecord, right: MemoryRecord): number {
  const byUpdated = right.updatedAt.localeCompare(left.updatedAt);
  if (byUpdated !== 0) return byUpdated;
  const leftActive = left.authority !== "archived" && left.authority !== "superseded" ? 1 : 0;
  const rightActive = right.authority !== "archived" && right.authority !== "superseded" ? 1 : 0;
  if (leftActive !== rightActive) return rightActive - leftActive;
  const byCreated = right.createdAt.localeCompare(left.createdAt);
  return byCreated !== 0 ? byCreated : right.id.localeCompare(left.id);
}

function monotonicTimestamp(project: ProjectState, requested?: string, ...related: Array<string | undefined>): string {
  const candidate = requested ?? new Date().toISOString();
  const timestamps = [project.metadata.createdAt, project.metadata.updatedAt, ...related.filter((value): value is string => typeof value === "string" && value.length > 0), candidate];
  let latest = 0;
  for (const timestamp of timestamps) {
    const time = Date.parse(timestamp);
    if (!Number.isFinite(time)) throw new Error("Promotion persistence timestamp must be valid.");
    latest = Math.max(latest, time);
  }
  return new Date(latest).toISOString();
}

function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
