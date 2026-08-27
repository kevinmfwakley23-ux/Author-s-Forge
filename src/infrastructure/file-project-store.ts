import type { MemoryRecord } from "../domain/memory";
import type { ProjectState } from "../domain/project";
import { PROJECT_FORMAT_VERSION } from "../domain/project";
import type { CharacterRecord } from "../domain/character-bible";
import { validateCharacterRecord } from "../domain/character-bible";
import type { VisualCharacterIdentity } from "../domain/character-visual-continuity";
import { validateVisualCharacterIdentity } from "../domain/character-visual-continuity";
import type { IllustrationAssetLibraryState } from "../domain/illustration-asset-library";
import { validateIllustrationAssetLibraryState } from "../domain/illustration-asset-library";
import type { BookCoverPlan } from "../domain/book-cover-studio";
import { validatePublishingConfiguration, calculateKdpCoverLayout } from "../domain/book-cover-studio";
import type { BookGenome } from "../domain/final-product-systems";
import { createBookGenome } from "../domain/final-product-systems";
import type { PublishingReadinessReport } from "../domain/publishing-readiness";
import { validatePublishingReadinessReport } from "../domain/publishing-readiness";
import type { KdpMarketIntelligenceReport } from "../domain/kdp-market-intelligence";
import { validateKdpMarketIntelligenceReport } from "../domain/kdp-market-intelligence";
import type { BookPositioningReport } from "../domain/book-positioning";
import { validateBookPositioningReport } from "../domain/book-positioning";
import { mkdir, readFile, rename, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";

export class FileProjectStore {
  public constructor(private readonly rootDirectory: string) {}

  public async create(project: ProjectState): Promise<void> {
    if (await this.exists(project.metadata.id)) throw new Error(`Project already exists: ${project.metadata.id}`);
    await this.save(project);
  }

  public async load(projectId: string): Promise<ProjectState | null> {
    try {
      const raw = await readFile(this.projectPath(projectId), "utf8");
      return this.validate(JSON.parse(raw), projectId);
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
    for (const memory of memories) if ((memory as MemoryRecord).projectId !== expectedId) throw new Error("Project memory state contains a memory from another project.");

    const characters = validateOptionalCharacters(candidate.characters, expectedId);
    const visualIdentities = validateOptionalVisualIdentities(candidate.visualIdentities, expectedId);
    const illustrationAssetLibrary = candidate.illustrationAssetLibrary === undefined ? undefined : validateProjectIllustrationLibrary(candidate.illustrationAssetLibrary, expectedId);
    const bookCoverPlans = validateOptionalBookCoverPlans(candidate.bookCoverPlans, expectedId);
    const publishingReadinessReports = validateOptional(candidate.publishingReadinessReports, (item) => validatePublishingReadinessReport(item), expectedId, "Project publishing readiness report");
    const kdpMarketIntelligenceReports = validateOptional(candidate.kdpMarketIntelligenceReports, (item) => validateKdpMarketIntelligenceReport(item), expectedId, "Project market intelligence report");
    const bookPositioningReports = validateOptional(candidate.bookPositioningReports, (item) => validateBookPositioningReport(item), expectedId, "Project book positioning report");
    const bookGenome = candidate.bookGenome === undefined ? undefined : validateBookGenome(candidate.bookGenome, expectedId);

    const normalized = JSON.parse(JSON.stringify(candidate)) as ProjectState & Record<string, unknown>;
    normalized.formatVersion = PROJECT_FORMAT_VERSION;
    normalized.metadata = {
      id: expectedId,
      title: record.title,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
      status: record.status === "archived" ? "archived" : "active",
    };
    normalized.memories = memories.map((memory) => cloneMemory(memory as MemoryRecord));
    if (characters) normalized.characters = characters;
    if (visualIdentities) normalized.visualIdentities = visualIdentities;
    if (illustrationAssetLibrary) normalized.illustrationAssetLibrary = cloneIllustrationAssetLibrary(illustrationAssetLibrary);
    if (bookCoverPlans) normalized.bookCoverPlans = bookCoverPlans;
    if (publishingReadinessReports) normalized.publishingReadinessReports = publishingReadinessReports;
    if (kdpMarketIntelligenceReports) normalized.kdpMarketIntelligenceReports = kdpMarketIntelligenceReports;
    if (bookPositioningReports) normalized.bookPositioningReports = bookPositioningReports;
    if (bookGenome) normalized.bookGenome = bookGenome;
    return normalized;
  }
}

function validateOptionalCharacters(value: unknown, expectedProjectId: string): CharacterRecord[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project character state.");
  const ids = new Set<string>();
  return value.map((character) => {
    const validated = validateCharacterRecord(character);
    if (validated.projectId !== expectedProjectId) throw new Error("Project character state contains a character from another project.");
    if (ids.has(validated.id)) throw new Error(`Duplicate character id \"${validated.id}\" in project state.`);
    ids.add(validated.id);
    return cloneCharacter(validated);
  });
}

function validateOptionalVisualIdentities(value: unknown, expectedProjectId: string): VisualCharacterIdentity[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project visual identity state.");
  const ids = new Set<string>();
  const characters = new Set<string>();
  return value.map((identity) => {
    const validated = validateVisualCharacterIdentity(identity);
    if (validated.projectId !== expectedProjectId) throw new Error("Project visual identity state contains an identity from another project.");
    if (ids.has(validated.id)) throw new Error(`Duplicate visual identity id \"${validated.id}\" in project state.`);
    if (characters.has(validated.characterId)) throw new Error(`Duplicate visual identity for character \"${validated.characterId}\" in project state.`);
    ids.add(validated.id);
    characters.add(validated.characterId);
    return cloneVisualIdentity(validated);
  });
}

function validateProjectIllustrationLibrary(value: unknown, expectedProjectId: string): IllustrationAssetLibraryState {
  const library = validateIllustrationAssetLibraryState(value);
  if (library.projectId !== expectedProjectId) throw new Error("Project illustration asset library belongs to another project.");
  return library;
}

function validateOptionalBookCoverPlans(value: unknown, expectedProjectId: string): BookCoverPlan[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project book cover plan state.");
  const ids = new Set<string>();
  return value.map((plan) => {
    const validated = validateBookCoverPlan(plan);
    if (validated.projectId !== expectedProjectId) throw new Error("Project book cover plan belongs to another project.");
    if (ids.has(validated.id)) throw new Error(`Duplicate book cover plan id \"${validated.id}\".`);
    ids.add(validated.id);
    return cloneBookCoverPlan(validated);
  });
}

function validateOptional<T>(value: unknown, validator: (item: unknown) => T, expectedProjectId: string, label: string): T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`Invalid ${label.toLowerCase()} state.`);
  const seen = new Set<string>();
  return value.map((item) => {
    const validated = validator(item) as T & { projectId?: unknown; id?: unknown };
    if (validated.projectId !== expectedProjectId) throw new Error(`${label} belongs to another project.`);
    if (typeof validated.id === "string") {
      if (seen.has(validated.id)) throw new Error(`Duplicate ${label.toLowerCase()} id \"${validated.id}\".`);
      seen.add(validated.id);
    }
    return JSON.parse(JSON.stringify(validated)) as T;
  });
}

function validateBookCoverPlan(value: unknown): BookCoverPlan {
  if (!value || typeof value !== "object") throw new Error("Invalid book cover plan.");
  const plan = value as BookCoverPlan;
  validatePublishingConfiguration(plan.publishing);
  const expected = calculateKdpCoverLayout(plan.publishing);
  if (plan.formatVersion !== 1 || typeof plan.id !== "string" || typeof plan.projectId !== "string" || expected.dimensions.widthInches !== plan.dimensions.widthInches || expected.dimensions.heightInches !== plan.dimensions.heightInches) {
    throw new Error("Invalid or corrupt book cover plan.");
  }
  return cloneBookCoverPlan(plan);
}

function validateBookGenome(value: unknown, expectedProjectId: string): BookGenome {
  if (!value || typeof value !== "object") throw new Error("Invalid Book Genome.");
  const candidate = value as BookGenome;
  if (candidate.projectId !== expectedProjectId) throw new Error("Book Genome belongs to another project.");
  if (candidate.formatVersion !== 1 || typeof candidate.generatedAt !== "string" || !Array.isArray(candidate.nodes)) throw new Error("Invalid or corrupt Book Genome.");
  return createBookGenome({ projectId: expectedProjectId, nodes: candidate.nodes, now: candidate.generatedAt });
}

function cloneMemory(memory: MemoryRecord): MemoryRecord { return { ...memory, provenance: memory.provenance.map((item) => ({ ...item })), relatedMemoryIds: [...memory.relatedMemoryIds], relevanceTags: [...memory.relevanceTags] }; }
function cloneCharacter(character: CharacterRecord): CharacterRecord { return validateCharacterRecord(JSON.parse(JSON.stringify(character))); }
function cloneVisualIdentity(identity: VisualCharacterIdentity): VisualCharacterIdentity { return validateVisualCharacterIdentity(JSON.parse(JSON.stringify(identity))); }
function cloneIllustrationAssetLibrary(library: IllustrationAssetLibraryState): IllustrationAssetLibraryState { return validateIllustrationAssetLibraryState(JSON.parse(JSON.stringify(library))); }
function cloneBookCoverPlan(plan: BookCoverPlan): BookCoverPlan { return JSON.parse(JSON.stringify(plan)) as BookCoverPlan; }
function isMemoryRecord(value: unknown): value is MemoryRecord { if (!value || typeof value !== "object") return false; const memory = value as Record<string, unknown>; return typeof memory.id === "string" && typeof memory.projectId === "string" && typeof memory.class === "string" && typeof memory.authority === "string" && typeof memory.summary === "string" && typeof memory.content === "string" && typeof memory.createdAt === "string" && typeof memory.updatedAt === "string" && Array.isArray(memory.provenance) && Array.isArray(memory.relatedMemoryIds) && Array.isArray(memory.relevanceTags); }
function isMissingFile(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"; }
