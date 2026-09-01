import { randomUUID } from "node:crypto";
import { createMemoryRecord, type MemoryRecord } from "../domain/memory";
import { withProjectMemories, type ProjectState } from "../domain/project";
import { getBook, validateStudioWorkspace } from "../domain/studio-workspace";
import {
  assessPublishingMetadata,
  createPublishingMetadata,
  requiresKdpAiDisclosure,
  validatePublishingMetadata,
  type PublishingMetadata,
  type PublishingMetadataCompliance,
} from "../domain/publishing-metadata";
import { FileProjectStore } from "../infrastructure/file-project-store";

export interface PublishingMetadataState {
  readonly metadata: PublishingMetadata;
  readonly compliance: PublishingMetadataCompliance;
  readonly kdpAiDisclosureRequired: boolean;
  readonly memoryId: string;
}

export class StudioPublishingMetadataService {
  public constructor(private readonly store: FileProjectStore) {}

  public async save(
    projectId: string,
    bookId: string,
    input: Omit<PublishingMetadata, "formatVersion" | "projectId" | "bookId" | "updatedAt">,
    options: { readonly now?: string; readonly memoryId?: string; readonly reference?: string } = {},
  ): Promise<PublishingMetadataState> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    const now = options.now ?? new Date().toISOString();
    const metadata = createPublishingMetadata({ ...input, projectId, bookId, updatedAt: now });
    const compliance = this.compliance(project, metadata);
    const priorIds = new Set(this.records(project, bookId).filter((record) => record.authority !== "archived").map((record) => record.id));
    const memories = project.memories.map((record) => priorIds.has(record.id) ? { ...record, authority: "archived" as const, updatedAt: now } : record);
    const memory = createMemoryRecord({
      id: options.memoryId ?? `publishing-metadata-${bookId}-${randomUUID()}`,
      projectId,
      class: "publishing-memory",
      authority: "working",
      summary: `Publishing metadata: ${metadata.title}`,
      content: JSON.stringify(metadata, null, 2),
      provenance: [{ kind: "author", reference: options.reference?.trim() || "publishing-office", recordedAt: now }],
      relatedMemoryIds: [],
      relevanceTags: ["publishing-metadata", `book:${bookId}`],
      now,
    });
    await this.store.save(withProjectMemories(project, [...memories, memory], now));
    return { metadata, compliance, kdpAiDisclosureRequired: requiresKdpAiDisclosure(metadata), memoryId: memory.id };
  }

  public async get(projectId: string, bookId: string): Promise<PublishingMetadataState | null> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    const current = this.records(project, bookId).filter((record) => record.authority !== "archived" && record.authority !== "superseded").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (!current) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(current.content); } catch { throw new Error(`Publishing metadata memory "${current.id}" contains invalid JSON.`); }
    const metadata = validatePublishingMetadata(parsed as PublishingMetadata);
    if (metadata.projectId !== projectId || metadata.bookId !== bookId) throw new Error("Publishing metadata memory belongs to another project or book.");
    return { metadata, compliance: this.compliance(project, metadata), kdpAiDisclosureRequired: requiresKdpAiDisclosure(metadata), memoryId: current.id };
  }

  public async history(projectId: string, bookId: string): Promise<readonly MemoryRecord[]> {
    const project = await this.load(projectId);
    this.requireBook(project, bookId);
    return this.records(project, bookId).map((record) => JSON.parse(JSON.stringify(record)) as MemoryRecord);
  }

  private compliance(project: ProjectState, metadata: PublishingMetadata): PublishingMetadataCompliance {
    const cover = [...(project.bookCoverPlans ?? [])].filter((plan) => plan.bookId === metadata.bookId).sort((a, b) => b.version - a.version)[0];
    return assessPublishingMetadata(metadata, { coverTitle: cover?.title, coverAuthor: cover?.author });
  }

  private records(project: ProjectState, bookId: string): MemoryRecord[] {
    return project.memories.filter((record) => record.class === "publishing-memory" && record.relevanceTags.includes("publishing-metadata") && record.relevanceTags.includes(`book:${bookId}`));
  }

  private async load(projectId: string): Promise<ProjectState> {
    if (typeof projectId !== "string" || !projectId.trim()) throw new Error("Project id is required for publishing metadata.");
    const project = await this.store.load(projectId);
    if (!project) throw new Error(`Project "${projectId}" was not found.`);
    return project;
  }

  private requireBook(project: ProjectState, bookId: string) {
    if (!project.studioWorkspace) throw new Error("Project has no Studio workspace.");
    return getBook(validateStudioWorkspace(project.studioWorkspace), bookId);
  }
}
