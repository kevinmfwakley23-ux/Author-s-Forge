import { randomUUID } from "node:crypto";
import { createMemoryRecord, type MemoryRecord } from "../domain/memory";
import {
  createPromotionPerformanceSnapshot,
  summarizePromotionPerformance,
  validatePromotionPerformanceSnapshot,
  type PromotionPerformanceSnapshot,
  type PromotionPerformanceSummary,
} from "../domain/promotion-performance";
import { withProjectMemories, type ProjectState } from "../domain/project";
import { getBook, validateStudioWorkspace } from "../domain/studio-workspace";
import { FileProjectStore } from "../infrastructure/file-project-store";
import { StudioMarketingCampaignService } from "./studio-marketing-campaign";

export interface PromotionPerformanceState {
  readonly snapshot: PromotionPerformanceSnapshot;
  readonly memoryId: string;
}

export class StudioPromotionPerformanceService {
  private readonly campaigns: StudioMarketingCampaignService;

  public constructor(private readonly store: FileProjectStore) {
    this.campaigns = new StudioMarketingCampaignService(store);
  }

  public async record(
    projectId: string,
    bookId: string,
    campaignId: string,
    input: Omit<PromotionPerformanceSnapshot, "formatVersion" | "projectId" | "bookId" | "campaignId">,
    options: { readonly now?: string; readonly memoryId?: string } = {},
  ): Promise<PromotionPerformanceState> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    const campaign = (await this.campaigns.get(projectId, bookId, campaignId)).campaign;
    const assetId = input.assetId?.trim();
    if (assetId && !campaign.assets.some((asset) => asset.id === assetId)) throw new Error(`Promotion performance asset "${assetId}" is not part of campaign "${campaign.id}".`);

    const snapshot = createPromotionPerformanceSnapshot({
      ...input,
      id: input.id?.trim() || `promotion-performance-${campaign.id}-${randomUUID()}`,
      projectId,
      bookId,
      campaignId: campaign.id,
      ...(assetId ? { assetId } : {}),
    });
    if (this.records(project, bookId, campaign.id).some((record) => record.relevanceTags.includes(`performance:${snapshot.id}`))) throw new Error(`Promotion performance snapshot "${snapshot.id}" already exists.`);

    const now = monotonicTimestamp(project, options.now);
    const memory = createMemoryRecord({
      id: options.memoryId ?? `promotion-performance-memory-${snapshot.id}-${randomUUID()}`,
      projectId,
      class: "marketing-memory",
      authority: "working",
      summary: `Observed promotion performance: ${snapshot.source}${snapshot.assetId ? ` / ${snapshot.assetId}` : ""}`,
      content: JSON.stringify(snapshot, null, 2),
      provenance: [{ kind: "author", reference: snapshot.sourceReference, recordedAt: now }],
      relatedMemoryIds: [],
      relevanceTags: [
        "promotion-performance",
        `book:${bookId}`,
        `campaign:${campaign.id}`,
        `performance:${snapshot.id}`,
        `source:${snapshot.source}`,
        ...(snapshot.assetId ? [`asset:${snapshot.assetId}`] : []),
      ],
      now,
    });
    await this.store.save(withProjectMemories(project, [...project.memories, memory], now));
    return { snapshot, memoryId: memory.id };
  }

  public async list(projectId: string, bookId: string, campaignId: string, assetId?: string): Promise<readonly PromotionPerformanceState[]> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    await this.campaigns.get(projectId, bookId, campaignId);
    const asset = assetId?.trim();
    return this.records(project, bookId, campaignId)
      .filter((record) => !asset || record.relevanceTags.includes(`asset:${asset}`))
      .map((record) => ({ snapshot: this.parse(record, projectId, bookId, campaignId), memoryId: record.id }))
      .sort((a, b) => b.snapshot.observedAt.localeCompare(a.snapshot.observedAt) || b.snapshot.periodEnd.localeCompare(a.snapshot.periodEnd) || b.snapshot.id.localeCompare(a.snapshot.id));
  }

  public async summary(projectId: string, bookId: string, campaignId: string, assetId?: string): Promise<PromotionPerformanceSummary> {
    return summarizePromotionPerformance((await this.list(projectId, bookId, campaignId, assetId)).map((item) => item.snapshot));
  }

  private records(project: ProjectState, bookId: string, campaignId: string): MemoryRecord[] {
    return project.memories.filter((record) =>
      record.class === "marketing-memory" &&
      record.relevanceTags.includes("promotion-performance") &&
      record.relevanceTags.includes(`book:${bookId}`) &&
      record.relevanceTags.includes(`campaign:${campaignId}`) &&
      record.authority !== "archived" && record.authority !== "superseded",
    );
  }

  private parse(record: MemoryRecord, projectId: string, bookId: string, campaignId: string): PromotionPerformanceSnapshot {
    let parsed: unknown;
    try { parsed = JSON.parse(record.content); } catch { throw new Error(`Promotion performance memory "${record.id}" contains invalid JSON.`); }
    const snapshot = validatePromotionPerformanceSnapshot(parsed as PromotionPerformanceSnapshot);
    if (snapshot.projectId !== projectId || snapshot.bookId !== bookId || snapshot.campaignId !== campaignId) throw new Error("Promotion performance memory belongs to another project, book, or campaign.");
    return snapshot;
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

function monotonicTimestamp(project: ProjectState, requested?: string): string {
  const candidate = requested ?? new Date().toISOString();
  const timestamps = [project.metadata.createdAt, project.metadata.updatedAt, candidate];
  let latest = 0;
  for (const timestamp of timestamps) {
    const time = Date.parse(timestamp);
    if (!Number.isFinite(time)) throw new Error("Promotion performance persistence timestamp must be valid.");
    latest = Math.max(latest, time);
  }
  return new Date(latest).toISOString();
}

function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
