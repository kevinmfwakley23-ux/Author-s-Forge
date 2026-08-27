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
import { mkdir, readFile, rename, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";

export class FileProjectStore {
  public constructor(private readonly rootDirectory: string) {}
  public async create(project: ProjectState): Promise<void> { if (await this.exists(project.metadata.id)) throw new Error(`Project already exists: ${project.metadata.id}`); await this.save(project); }
  public async load(projectId: string): Promise<ProjectState | null> { try { const raw = await readFile(this.projectPath(projectId), "utf8"); return this.validate(JSON.parse(raw), projectId); } catch (error) { if (isMissingFile(error)) return null; throw error; } }
  public async save(project: ProjectState): Promise<void> { const path = this.projectPath(project.metadata.id); await mkdir(dirname(path), { recursive: true }); const temporaryPath = `${path}.tmp`; await writeFile(temporaryPath, `${JSON.stringify(project, null, 2)}\n`, "utf8"); await rename(temporaryPath, path); }
  public async exists(projectId: string): Promise<boolean> { try { await access(this.projectPath(projectId)); return true; } catch (error) { if (isMissingFile(error)) return false; throw error; } }
  private projectPath(projectId: string): string { if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Project id contains unsupported path characters."); return join(this.rootDirectory, "projects", projectId, "project.json"); }
  private validate(value: unknown, expectedId: string): ProjectState {
    if (!value || typeof value !== "object") throw new Error("Invalid project package."); const candidate = value as Record<string, unknown>; const metadata = candidate.metadata;
    if (!metadata || typeof metadata !== "object") throw new Error("Invalid project metadata."); const record = metadata as Record<string, unknown>;
    if ((candidate.formatVersion !== 1 && candidate.formatVersion !== PROJECT_FORMAT_VERSION) || record.id !== expectedId || typeof record.title !== "string") throw new Error("Unsupported or corrupt project package.");
    const memories = candidate.memories === undefined ? [] : candidate.memories; if (!Array.isArray(memories) || !memories.every(isMemoryRecord)) throw new Error("Invalid project memory state.");
    const characters = candidate.characters === undefined ? undefined : candidate.characters; if (characters !== undefined) { if (!Array.isArray(characters)) throw new Error("Invalid project character state."); for (const character of characters) { const validated = validateCharacterRecord(character); if (validated.projectId !== expectedId) throw new Error("Project character state contains a character from another project."); } }
    const visualIdentities = candidate.visualIdentities === undefined ? undefined : candidate.visualIdentities; if (visualIdentities !== undefined) { if (!Array.isArray(visualIdentities)) throw new Error("Invalid project visual identity state."); for (const identity of visualIdentities) { const validated = validateVisualCharacterIdentity(identity); if (validated.projectId !== expectedId) throw new Error("Project visual identity state contains an identity from another project."); } }
    const illustrationAssetLibrary = candidate.illustrationAssetLibrary === undefined ? undefined : validateIllustrationAssetLibraryState(candidate.illustrationAssetLibrary);
    if (illustrationAssetLibrary !== undefined && illustrationAssetLibrary.projectId !== expectedId) throw new Error("Project illustration asset library belongs to another project.");
    const bookCoverPlans = candidate.bookCoverPlans === undefined ? undefined : candidate.bookCoverPlans;
    if (bookCoverPlans !== undefined) { if (!Array.isArray(bookCoverPlans)) throw new Error("Invalid project book cover plan state."); const ids = new Set<string>(); for (const plan of bookCoverPlans) { const validated = validateBookCoverPlan(plan); if (validated.projectId !== expectedId) throw new Error("Project book cover plan belongs to another project."); if (ids.has(validated.id)) throw new Error(`Duplicate book cover plan id \"${validated.id}\".`); ids.add(validated.id); } }
    return { formatVersion: PROJECT_FORMAT_VERSION, metadata: { id: expectedId, title: record.title, createdAt: typeof record.createdAt === "string" ? record.createdAt : "", updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "", status: record.status === "archived" ? "archived" : "active" }, memories: memories.map(cloneMemory), ...(characters !== undefined ? { characters: characters.map((character) => cloneCharacter(character as CharacterRecord)) } : {}), ...(visualIdentities !== undefined ? { visualIdentities: visualIdentities.map((identity) => cloneVisualIdentity(identity as VisualCharacterIdentity)) } : {}), ...(illustrationAssetLibrary !== undefined ? { illustrationAssetLibrary: cloneIllustrationAssetLibrary(illustrationAssetLibrary) } : {}), ...(bookCoverPlans !== undefined ? { bookCoverPlans: bookCoverPlans.map((plan) => cloneBookCoverPlan(plan as BookCoverPlan)) } : {}) };
  }
}
function isMemoryRecord(value: unknown): value is MemoryRecord { if (!value || typeof value !== "object") return false; const memory = value as Record<string, unknown>; return typeof memory.id === "string" && typeof memory.projectId === "string" && typeof memory.class === "string" && typeof memory.authority === "string" && typeof memory.summary === "string" && typeof memory.content === "string" && typeof memory.createdAt === "string" && typeof memory.updatedAt === "string" && Array.isArray(memory.provenance) && Array.isArray(memory.relatedMemoryIds) && Array.isArray(memory.relevanceTags); }
function validateBookCoverPlan(value: unknown): BookCoverPlan { if (!value || typeof value !== "object") throw new Error("Invalid book cover plan."); const plan = value as BookCoverPlan; validatePublishingConfiguration(plan.publishing); const expected = calculateKdpCoverLayout(plan.publishing); if (plan.formatVersion !== 1 || typeof plan.id !== "string" || typeof plan.projectId !== "string" || expected.dimensions.widthInches !== plan.dimensions.widthInches || expected.dimensions.heightInches !== plan.dimensions.heightInches) throw new Error("Invalid or corrupt book cover plan."); return cloneBookCoverPlan(plan); }
function cloneMemory(memory: MemoryRecord): MemoryRecord { return { ...memory, provenance: memory.provenance.map((item) => ({ ...item })), relatedMemoryIds: [...memory.relatedMemoryIds], relevanceTags: [...memory.relevanceTags] }; }
function cloneCharacter(character: CharacterRecord): CharacterRecord { return validateCharacterRecord(JSON.parse(JSON.stringify(character))); }
function cloneVisualIdentity(identity: VisualCharacterIdentity): VisualCharacterIdentity { return validateVisualCharacterIdentity(JSON.parse(JSON.stringify(identity))); }
function cloneIllustrationAssetLibrary(library: IllustrationAssetLibraryState): IllustrationAssetLibraryState { return validateIllustrationAssetLibraryState(JSON.parse(JSON.stringify(library))); }
function cloneBookCoverPlan(plan: BookCoverPlan): BookCoverPlan { return JSON.parse(JSON.stringify(plan)) as BookCoverPlan; }
function isMissingFile(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"; }
