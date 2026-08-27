import { mkdir, readFile, rename, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ProjectStore } from "../application/project-store";
import type { ProjectState } from "../domain/project";
import { PROJECT_FORMAT_VERSION } from "../domain/project";
import type { MemoryRecord } from "../domain/memory";

export class FileProjectStore implements ProjectStore {
  public constructor(private readonly rootDirectory: string) {}

  public async create(project: ProjectState): Promise<void> {
    if (await this.exists(project.metadata.id)) throw new Error(`Project already exists: ${project.metadata.id}`);
    await this.save(project);
  }

  public async load(projectId: string): Promise<ProjectState | null> {
    try {
      const raw = await readFile(this.projectPath(projectId), "utf8");
      const parsed: unknown = JSON.parse(raw);
      return this.validate(parsed, projectId);
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  }

  public async save(project: ProjectState): Promise<void> {
    const path = this.projectPath(project.metadata.id);
    await mkdir(dirname(path), { recursive: true });
    const temporaryPath = `${path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(project, null, 2)}\n`, "utf8");
    await rename(temporaryPath, path);
  }

  public async exists(projectId: string): Promise<boolean> {
    try {
      await access(this.projectPath(projectId));
      return true;
    } catch (error) {
      if (isMissingFile(error)) return false;
      throw error;
    }
  }

  private projectPath(projectId: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Project id contains unsupported path characters.");
    return join(this.rootDirectory, "projects", projectId, "project.json");
  }

  private validate(value: unknown, expectedId: string): ProjectState {
    if (!value || typeof value !== "object") throw new Error("Invalid project package.");
    const candidate = value as Record<string, unknown>;
    const metadata = candidate.metadata;
    if (!metadata || typeof metadata !== "object") throw new Error("Invalid project metadata.");
    const record = metadata as Record<string, unknown>;
    if ((candidate.formatVersion !== 1 && candidate.formatVersion !== PROJECT_FORMAT_VERSION) || record.id !== expectedId || typeof record.title !== "string") {
      throw new Error("Unsupported or corrupt project package.");
    }
    const memories = candidate.memories === undefined ? [] : candidate.memories;
    if (!Array.isArray(memories) || !memories.every(isMemoryRecord)) throw new Error("Invalid project memory state.");
    return {
      formatVersion: PROJECT_FORMAT_VERSION,
      metadata: {
        id: record.id,
        title: record.title,
        createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
        updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
        status: record.status === "archived" ? "archived" : "active"
      },
      memories: memories.map(cloneMemory)
    };
  }
}

function isMemoryRecord(value: unknown): value is MemoryRecord {
  if (!value || typeof value !== "object") return false;
  const memory = value as Record<string, unknown>;
  return typeof memory.id === "string"
    && typeof memory.projectId === "string"
    && typeof memory.class === "string"
    && typeof memory.authority === "string"
    && typeof memory.summary === "string"
    && typeof memory.content === "string"
    && typeof memory.createdAt === "string"
    && typeof memory.updatedAt === "string"
    && Array.isArray(memory.provenance)
    && Array.isArray(memory.relatedMemoryIds)
    && Array.isArray(memory.relevanceTags);
}

function cloneMemory(memory: MemoryRecord): MemoryRecord {
  return { ...memory, provenance: memory.provenance.map((item) => ({ ...item })), relatedMemoryIds: [...memory.relatedMemoryIds], relevanceTags: [...memory.relevanceTags] };
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}
