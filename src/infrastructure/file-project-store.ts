import type { MemoryRecord } from "../domain/memory";
import type { ProjectState } from "../domain/project";
import { PROJECT_FORMAT_VERSION } from "../domain/project";
import type { CharacterRecord } from "../domain/character-bible";
import { validateCharacterRecord } from "../domain/character-bible";
import type { CharacterStateMemory } from "../domain/character-state-memory";
import { validateCharacterStateMemory } from "../domain/character-state-memory";
import type { VisualCharacterIdentity } from "../domain/character-visual-continuity";
import { validateVisualCharacterIdentity } from "../domain/character-visual-continuity";
import type { IllustrationAssetLibraryState } from "../domain/illustration-asset-library";
import { validateIllustrationAssetLibraryState } from "../domain/illustration-asset-library";
import type { BookCoverPlan } from "../domain/book-cover-studio";
import { validatePublishingConfiguration, calculateKdpCoverLayout } from "../domain/book-cover-studio";
import type { BookGenome } from "../domain/final-product-systems";
import { createBookGenome } from "../domain/final-product-systems";
import type { BookSnapshot, BookVersionHistory, BookVersionBranch } from "../domain/book-version-control";
import { validateBookSnapshot } from "../domain/book-version-control";
import type { AuthorDecision } from "../domain/author-control";
import { validateAuthorDecision } from "../domain/author-control";
import type { SeriesState } from "../domain/series";
import { validateSeriesState } from "../domain/series";
import type { VoiceFingerprint, VoiceProfile } from "../domain/voice-preservation";
import type { AuthorVoiceMemory, VoiceMemorySample, VoiceMemoryEvolutionEvent } from "../domain/author-voice-memory";
import type { AiCollaborationPolicy } from "../domain/ai-collaboration";
import { validateAiCollaborationPolicy } from "../domain/ai-collaboration";
import type { ProjectHealthReport } from "../domain/project-health";
import { validateProjectHealthReport } from "../domain/project-health";
import type { MemoryRelationship } from "../domain/relationship-memory";
import { validateMemoryRelationship } from "../domain/relationship-memory";
import type { DeliveryAuditReport } from "../domain/delivery-audit";
import { validateDeliveryAuditReport } from "../domain/delivery-audit";
import { validatePublishingReadinessReport } from "../domain/publishing-readiness";
import { validateKdpMarketIntelligenceReport } from "../domain/kdp-market-intelligence";
import { validateBookPositioningReport } from "../domain/book-positioning";
import { createAuthorGoal, type AuthorGoal } from "../domain/author-goals";
import { validateStudioWorkspace, type StudioWorkspaceState } from "../domain/studio-workspace";
import { randomUUID } from "node:crypto";
import { access, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

const LEGACY_PROJECT_FORMAT_VERSION = 2 as const;
const MEMORY_CLASSES = new Set(["author-memory", "project-memory", "story-canon", "character-memory", "relationship-memory", "location-memory", "timeline-memory", "style-memory", "research-memory", "creative-note", "working-draft", "hypothesis", "open-thread", "visual-identity", "production-memory", "publishing-memory", "marketing-memory", "generated-alternative", "decision-memory"]);
const MEMORY_AUTHORITIES = new Set(["proposed", "working", "verified", "authoritative", "superseded", "archived"]);

export class FileProjectStore {
  public constructor(private readonly rootDirectory: string) {}
  public async create(project: ProjectState): Promise<void> { if (await this.exists(project.metadata.id)) throw new Error(`Project already exists: ${project.metadata.id}`); await this.save(project); }
  public async load(projectId: string): Promise<ProjectState | null> { try { const raw = await readFile(this.projectPath(projectId), "utf8"); return this.validate(JSON.parse(raw), projectId); } catch (error) { if (isMissingFile(error)) return null; throw error; } }
  public async save(project: ProjectState): Promise<void> {
    const path = this.projectPath(project.metadata.id);
    const directory = dirname(path);
    const validated = this.validate(project, project.metadata.id);
    await mkdir(directory, { recursive: true });
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    const persisted = JSON.parse(JSON.stringify(validated)) as Record<string, unknown>;
    persisted.formatVersion = PROJECT_FORMAT_VERSION;
    const serialized = `${JSON.stringify(persisted, null, 2)}\n`;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporaryPath, "wx", 0o600);
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporaryPath, path);
      await syncDirectoryBestEffort(directory);
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      await unlink(temporaryPath).catch((cleanupError) => { if (!isMissingFile(cleanupError)) throw cleanupError; });
      throw error;
    }
  }
  public async exists(projectId: string): Promise<boolean> { try { await access(this.projectPath(projectId)); return true; } catch (error) { if (isMissingFile(error)) return false; throw error; } }
  private projectPath(projectId: string): string { if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Project id contains unsupported path characters."); return join(this.rootDirectory, "projects", projectId, "project.json"); }
  private validate(value: unknown, expectedId: string): ProjectState {
    if (!value || typeof value !== "object") throw new Error("Invalid project package.");
    const candidate = value as Record<string, unknown>;
    const metadata = candidate.metadata;
    if (!metadata || typeof metadata !== "object") throw new Error("Invalid project metadata.");
    const record = metadata as Record<string, unknown>;
    if ((candidate.formatVersion !== 1 && candidate.formatVersion !== LEGACY_PROJECT_FORMAT_VERSION && candidate.formatVersion !== PROJECT_FORMAT_VERSION) || record.id !== expectedId || typeof record.title !== "string") throw new Error("Unsupported or corrupt project package.");

    const memories = validateProjectMemories(candidate.memories, expectedId);
    const studioWorkspace = candidate.studioWorkspace === undefined ? undefined : validateStudioWorkspace(candidate.studioWorkspace as StudioWorkspaceState);
    const authorGoals = validateOptionalAuthorGoals(candidate.authorGoals);
    const characters = validateOptionalCharacters(candidate.characters, expectedId);
    const characterStateMemories = validateOptionalCharacterStateMemories(candidate.characterStateMemories, expectedId, characters ?? []);
    const visualIdentities = validateOptionalVisualIdentities(candidate.visualIdentities, expectedId);
    const illustrationAssetLibrary = candidate.illustrationAssetLibrary === undefined ? undefined : validateProjectIllustrationLibrary(candidate.illustrationAssetLibrary, expectedId);
    const bookCoverPlans = validateOptionalBookCoverPlans(candidate.bookCoverPlans, expectedId);
    const publishingReadinessReports = validateOptional(candidate.publishingReadinessReports, validatePublishingReadinessReport, expectedId, "Project publishing readiness report");
    const kdpMarketIntelligenceReports = validateOptional(candidate.kdpMarketIntelligenceReports, validateKdpMarketIntelligenceReport, expectedId, "Project market intelligence report");
    const bookPositioningReports = validateOptional(candidate.bookPositioningReports, validateBookPositioningReport, expectedId, "Project book positioning report");
    const bookVersionHistories = validateOptionalBookVersionHistories(candidate.bookVersionHistories, expectedId);
    const authorDecisions = validateOptional(candidate.authorDecisions, validateAuthorDecision, expectedId, "Project author decision");
    const series = validateOptional(candidate.series, validateSeriesState, expectedId, "Project series");
    const voiceProfiles = validateOptionalVoiceProfiles(candidate.voiceProfiles, expectedId);
    const authorVoiceMemory = candidate.authorVoiceMemory === undefined ? undefined : validateProjectAuthorVoiceMemory(candidate.authorVoiceMemory, expectedId);
    const aiCollaborationPolicy = candidate.aiCollaborationPolicy === undefined ? undefined : validateAiCollaborationPolicy(candidate.aiCollaborationPolicy as AiCollaborationPolicy);
    const projectHealthReports = validateOptionalProjectHealthReports(candidate.projectHealthReports, expectedId);
    const memoryRelationships = validateOptionalMemoryRelationships(candidate.memoryRelationships, expectedId, memories);
    const deliveryAudits = validateOptionalDeliveryAudits(candidate.deliveryAudits, expectedId);
    const bookGenome = candidate.bookGenome === undefined ? undefined : validateBookGenome(candidate.bookGenome, expectedId);

    const normalized = JSON.parse(JSON.stringify(candidate)) as Record<string, unknown>;
    normalized.formatVersion = PROJECT_FORMAT_VERSION;
    normalized.metadata = { id: expectedId, title: record.title, createdAt: typeof record.createdAt === "string" ? record.createdAt : "", updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "", status: record.status === "archived" ? "archived" : "active" };
    normalized.memories = memories;
    if (studioWorkspace) normalized.studioWorkspace = validateStudioWorkspace(JSON.parse(JSON.stringify(studioWorkspace)));
    if (authorGoals) normalized.authorGoals = authorGoals.map((goal) => ({ ...goal }));
    if (characters) normalized.characters = characters;
    if (characterStateMemories) normalized.characterStateMemories = characterStateMemories;
    if (visualIdentities) normalized.visualIdentities = visualIdentities;
    if (illustrationAssetLibrary) normalized.illustrationAssetLibrary = cloneIllustrationAssetLibrary(illustrationAssetLibrary);
    if (bookCoverPlans) normalized.bookCoverPlans = bookCoverPlans;
    if (publishingReadinessReports) normalized.publishingReadinessReports = publishingReadinessReports;
    if (kdpMarketIntelligenceReports) normalized.kdpMarketIntelligenceReports = kdpMarketIntelligenceReports;
    if (bookPositioningReports) normalized.bookPositioningReports = bookPositioningReports;
    if (bookVersionHistories) normalized.bookVersionHistories = bookVersionHistories;
    if (authorDecisions) normalized.authorDecisions = authorDecisions;
    if (series) normalized.series = series;
    if (voiceProfiles) normalized.voiceProfiles = voiceProfiles;
    if (authorVoiceMemory) normalized.authorVoiceMemory = authorVoiceMemory;
    if (aiCollaborationPolicy) normalized.aiCollaborationPolicy = aiCollaborationPolicy;
    if (projectHealthReports) normalized.projectHealthReports = projectHealthReports;
    if (memoryRelationships) normalized.memoryRelationships = memoryRelationships;
    if (deliveryAudits) normalized.deliveryAudits = deliveryAudits;
    if (bookGenome) normalized.bookGenome = bookGenome;
    return normalized as unknown as ProjectState;
  }
}

async function syncDirectoryBestEffort(directory: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(directory, "r");
    await handle.sync();
  } catch (error) {
    if (!isUnsupportedDirectorySync(error)) throw error;
  } finally {
    if (handle) await handle.close().catch(() => undefined);
  }
}

function validateProjectMemories(value: unknown, expectedProjectId: string): MemoryRecord[] {
  const memories = value === undefined ? [] : value;
  if (!Array.isArray(memories)) throw new Error("Invalid project memory state.");
  const ids = new Set<string>();
  return memories.map((raw) => {
    const memory = validateMemoryRecordShape(raw);
    if (memory.projectId !== expectedProjectId) throw new Error("Project memory state contains a memory from another project.");
    if (ids.has(memory.id)) throw new Error(`Duplicate memory id \"${memory.id}\" in project state.`);
    ids.add(memory.id);
    return cloneMemory(memory);
  });
}

function validateMemoryRecordShape(value: unknown): MemoryRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid project memory record.");
  const memory = value as Record<string, unknown>;
  for (const field of ["id", "projectId", "summary", "content", "createdAt", "updatedAt"] as const) if (typeof memory[field] !== "string" || !String(memory[field]).trim()) throw new Error(`Invalid memory ${field}.`);
  if (!MEMORY_CLASSES.has(String(memory.class))) throw new Error("Invalid memory class.");
  if (!MEMORY_AUTHORITIES.has(String(memory.authority))) throw new Error("Invalid memory authority.");
  if (Number.isNaN(Date.parse(String(memory.createdAt))) || Number.isNaN(Date.parse(String(memory.updatedAt)))) throw new Error("Invalid memory timestamp.");
  if (!Array.isArray(memory.provenance) || !Array.isArray(memory.relatedMemoryIds) || !Array.isArray(memory.relevanceTags)) throw new Error("Invalid project memory collections.");
  for (const item of memory.provenance) {
    if (!item || typeof item !== "object") throw new Error("Invalid memory provenance.");
    const provenance = item as Record<string, unknown>;
    if (!["source", "author", "system"].includes(String(provenance.kind)) || typeof provenance.reference !== "string" || !provenance.reference.trim() || typeof provenance.recordedAt !== "string" || Number.isNaN(Date.parse(provenance.recordedAt))) throw new Error("Invalid memory provenance.");
  }
  if (memory.authority === "authoritative" && memory.provenance.length === 0) throw new Error("Authoritative memory requires provenance.");
  for (const field of ["relatedMemoryIds", "relevanceTags"] as const) {
    const entries = memory[field] as unknown[];
    if (entries.some((entry) => typeof entry !== "string" || !entry.trim()) || new Set(entries).size !== entries.length) throw new Error(`Invalid memory ${field}.`);
  }
  if (memory.supersedes !== undefined && (typeof memory.supersedes !== "string" || !memory.supersedes.trim() || memory.supersedes === memory.id)) throw new Error("Invalid memory supersedes reference.");
  if (memory.supersededBy !== undefined && (typeof memory.supersededBy !== "string" || !memory.supersededBy.trim() || memory.supersededBy === memory.id)) throw new Error("Invalid memory supersededBy reference.");
  return value as MemoryRecord;
}

function validateOptionalAuthorGoals(value: unknown): AuthorGoal[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project author goals state.");
  const ids = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid author goal.");
    const goal = raw as AuthorGoal;
    const validated = createAuthorGoal({ id: goal.id, metric: goal.metric, target: goal.target, period: goal.period, label: goal.label });
    if (ids.has(validated.id)) throw new Error(`Duplicate author goal id \"${validated.id}\".`);
    ids.add(validated.id);
    return validated;
  });
}

function validateOptionalCharacters(value: unknown, expectedProjectId: string): CharacterRecord[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project character state.");
  const ids = new Set<string>();
  return value.map((character) => { const validated = validateCharacterRecord(character); if (validated.projectId !== expectedProjectId) throw new Error("Project character state contains a character from another project."); if (ids.has(validated.id)) throw new Error(`Duplicate character id \"${validated.id}\" in project state.`); ids.add(validated.id); return cloneCharacter(validated); });
}

function validateOptionalCharacterStateMemories(value: unknown, expectedProjectId: string, characters: readonly CharacterRecord[]): CharacterStateMemory[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project character state memory.");
  const knownCharacters = new Set(characters.map((character) => character.id));
  const ids = new Set<string>();
  return value.map((raw) => {
    const validated = validateCharacterStateMemory(raw);
    if (validated.projectId !== expectedProjectId) throw new Error("Project character state memory belongs to another project.");
    if (!knownCharacters.has(validated.characterId)) throw new Error(`Character state memory references missing character \"${validated.characterId}\".`);
    if (ids.has(validated.characterId)) throw new Error(`Duplicate character state memory for \"${validated.characterId}\".`);
    ids.add(validated.characterId);
    return JSON.parse(JSON.stringify(validated)) as CharacterStateMemory;
  });
}

function validateOptionalVisualIdentities(value: unknown, expectedProjectId: string): VisualCharacterIdentity[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project visual identity state.");
  const ids = new Set<string>(); const characters = new Set<string>();
  return value.map((identity) => { const validated = validateVisualCharacterIdentity(identity); if (validated.projectId !== expectedProjectId) throw new Error("Project visual identity state contains an identity from another project."); if (ids.has(validated.id)) throw new Error(`Duplicate visual identity id \"${validated.id}\" in project state.`); if (characters.has(validated.characterId)) throw new Error(`Duplicate visual identity for character \"${validated.characterId}\" in project state.`); ids.add(validated.id); characters.add(validated.characterId); return cloneVisualIdentity(validated); });
}

function validateProjectIllustrationLibrary(value: unknown, expectedProjectId: string): IllustrationAssetLibraryState { const library = validateIllustrationAssetLibraryState(value); if (library.projectId !== expectedProjectId) throw new Error("Project illustration asset library belongs to another project."); return library; }

function validateOptionalBookCoverPlans(value: unknown, expectedProjectId: string): BookCoverPlan[] | undefined {
  if (value === undefined) return undefined; if (!Array.isArray(value)) throw new Error("Invalid project book cover plan state."); const ids = new Set<string>();
  return value.map((plan) => { const validated = validateBookCoverPlan(plan); if (validated.projectId !== expectedProjectId) throw new Error("Project book cover plan belongs to another project."); if (ids.has(validated.id)) throw new Error(`Duplicate book cover plan id \"${validated.id}\".`); ids.add(validated.id); return cloneBookCoverPlan(validated); });
}

function validateOptionalBookVersionHistories(value: unknown, expectedProjectId: string): BookVersionHistory[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project book version history state.");
  const books = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid book version history.");
    const history = raw as BookVersionHistory;
    if (history.projectId !== expectedProjectId || typeof history.bookId !== "string" || !history.bookId.trim() || !Array.isArray(history.versions) || !Array.isArray(history.branches)) throw new Error("Invalid book version history.");
    if (books.has(history.bookId)) throw new Error(`Duplicate version history for book \"${history.bookId}\".`);
    books.add(history.bookId);
    const versionIds = new Set<string>();
    const versions = history.versions.map((version) => {
      const validated = validateBookSnapshot(version as BookSnapshot);
      if (validated.projectId !== expectedProjectId || validated.bookId !== history.bookId) throw new Error("Version history contains an incorrectly scoped version.");
      if (versionIds.has(validated.id)) throw new Error(`Duplicate book version id \"${validated.id}\".`);
      versionIds.add(validated.id);
      return validated;
    });
    const branchIds = new Set<string>();
    const branches = history.branches.map((branch) => validateBookVersionBranch(branch, expectedProjectId, history.bookId, versionIds, branchIds));
    return JSON.parse(JSON.stringify({ projectId: expectedProjectId, bookId: history.bookId, versions, branches })) as BookVersionHistory;
  });
}

function validateBookVersionBranch(value: BookVersionBranch, projectId: string, bookId: string, versionIds: ReadonlySet<string>, branchIds: Set<string>): BookVersionBranch {
  if (!value || typeof value !== "object" || typeof value.id !== "string" || !value.id.trim() || value.projectId !== projectId || value.bookId !== bookId || typeof value.name !== "string" || !value.name.trim() || typeof value.baseVersionId !== "string" || typeof value.headVersionId !== "string" || typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) throw new Error("Invalid book version branch.");
  if (!versionIds.has(value.baseVersionId) || !versionIds.has(value.headVersionId)) throw new Error("Book version branch references a missing version.");
  if (branchIds.has(value.id)) throw new Error(`Duplicate book version branch id \"${value.id}\".`);
  branchIds.add(value.id);
  return JSON.parse(JSON.stringify(value)) as BookVersionBranch;
}

function validateOptionalVoiceProfiles(value: unknown, expectedProjectId: string): VoiceProfile[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project voice profile state.");
  const ids = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid voice profile.");
    const profile = raw as VoiceProfile;
    if (typeof profile.id !== "string" || !profile.id.trim() || profile.projectId !== expectedProjectId || typeof profile.authorId !== "string" || !profile.authorId.trim() || typeof profile.createdAt !== "string" || Number.isNaN(Date.parse(profile.createdAt)) || !Array.isArray(profile.sampleIds)) throw new Error("Invalid voice profile.");
    if (profile.sampleIds.some((id) => typeof id !== "string" || !id.trim()) || new Set(profile.sampleIds).size !== profile.sampleIds.length) throw new Error("Invalid voice profile sample ids.");
    validateVoiceFingerprint(profile.fingerprint);
    if (ids.has(profile.id)) throw new Error(`Duplicate voice profile id \"${profile.id}\".`);
    ids.add(profile.id);
    return JSON.parse(JSON.stringify(profile)) as VoiceProfile;
  });
}

function validateProjectAuthorVoiceMemory(value: unknown, expectedProjectId: string): AuthorVoiceMemory {
  if (!value || typeof value !== "object") throw new Error("Invalid author voice memory.");
  const memory = value as AuthorVoiceMemory;
  if (memory.formatVersion !== 3 || typeof memory.id !== "string" || !memory.id.trim() || memory.projectId !== expectedProjectId || typeof memory.authorId !== "string" || !memory.authorId.trim() || !Array.isArray(memory.samples) || memory.samples.length === 0 || !Array.isArray(memory.canonicalSampleIds) || !Array.isArray(memory.evolution) || typeof memory.createdAt !== "string" || typeof memory.updatedAt !== "string" || Number.isNaN(Date.parse(memory.createdAt)) || Number.isNaN(Date.parse(memory.updatedAt))) throw new Error("Invalid author voice memory.");
  const sampleIds = new Set<string>();
  for (const sample of memory.samples) validateVoiceMemorySample(sample, sampleIds);
  if (memory.canonicalSampleIds.some((id) => typeof id !== "string" || !sampleIds.has(id)) || new Set(memory.canonicalSampleIds).size !== memory.canonicalSampleIds.length) throw new Error("Invalid canonical author voice sample ids.");
  validateVoiceFingerprint(memory.fingerprint);
  for (const score of Object.values(memory.dimensions)) if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error("Invalid author voice dimension score.");
  for (const item of memory.evolution) validateVoiceEvolutionEvent(item, sampleIds);
  return JSON.parse(JSON.stringify(memory)) as AuthorVoiceMemory;
}

function validateVoiceMemorySample(sample: VoiceMemorySample, ids: Set<string>): void {
  if (!sample || typeof sample !== "object" || typeof sample.id !== "string" || !sample.id.trim() || typeof sample.label !== "string" || !sample.label.trim() || typeof sample.text !== "string" || !sample.text.trim() || typeof sample.approved !== "boolean" || !Number.isFinite(sample.weight) || sample.weight < 0 || !["author", "approved-manuscript"].includes(sample.source)) throw new Error("Invalid author voice sample.");
  if (sample.purpose !== undefined && !["prose", "dialogue", "description", "narration", "other"].includes(sample.purpose)) throw new Error("Invalid author voice sample purpose.");
  if (ids.has(sample.id)) throw new Error(`Duplicate author voice sample id \"${sample.id}\".`);
  ids.add(sample.id);
  validateVoiceFingerprint(sample.fingerprint);
}

function validateVoiceEvolutionEvent(item: VoiceMemoryEvolutionEvent, sampleIds: ReadonlySet<string>): void {
  if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id.trim() || typeof item.at !== "string" || Number.isNaN(Date.parse(item.at)) || !["sample-added", "sample-removed", "canonical-set"].includes(item.type) || !Array.isArray(item.sampleIds) || typeof item.reason !== "string" || !item.reason.trim()) throw new Error("Invalid author voice evolution event.");
  if (item.type === "canonical-set" && item.sampleIds.some((id) => !sampleIds.has(id))) throw new Error("Author voice canonical-set event references a missing sample.");
}

function validateVoiceFingerprint(value: VoiceFingerprint): void {
  if (!value || typeof value !== "object") throw new Error("Invalid voice fingerprint.");
  for (const key of ["sentenceLengthMean", "sentenceLengthMedian", "punctuationRate", "dialogueRatio", "vocabularyRichness", "paragraphLengthMean", "descriptionDensity", "metaphorDensity", "pacing", "emotionalIntensity"] as const) if (!Number.isFinite(value[key]) || value[key] < 0) throw new Error("Invalid voice fingerprint metric.");
  if (!Number.isInteger(value.sampleWordCount) || value.sampleWordCount < 0 || !["first-person", "second-person", "third-person", "mixed", "undetermined"].includes(value.narrativeDistance)) throw new Error("Invalid voice fingerprint.");
}

function validateOptionalProjectHealthReports(value: unknown, expectedProjectId: string): ProjectHealthReport[] | undefined {
  const reports = validateOptional(value, validateProjectHealthReport, expectedProjectId, "Project health report");
  if (!reports) return undefined;
  const generated = new Set<string>();
  for (const report of reports) { if (generated.has(report.generatedAt)) throw new Error(`Duplicate project health report timestamp \"${report.generatedAt}\".`); generated.add(report.generatedAt); }
  return reports;
}

function validateOptionalMemoryRelationships(value: unknown, expectedProjectId: string, memories: readonly MemoryRecord[]): MemoryRelationship[] | undefined {
  const relationships = validateOptional(value, validateMemoryRelationship, expectedProjectId, "Project memory relationship");
  if (!relationships) return undefined;
  const ids = new Set<string>();
  const memoryIds = new Set(memories.map((memory) => memory.id));
  for (const relationship of relationships) {
    if (ids.has(relationship.id)) throw new Error(`Duplicate memory relationship id \"${relationship.id}\".`);
    ids.add(relationship.id);
    if (!memoryIds.has(relationship.sourceMemoryId) || !memoryIds.has(relationship.targetMemoryId)) throw new Error(`Memory relationship \"${relationship.id}\" references missing project memory.`);
  }
  return relationships;
}

function validateOptionalDeliveryAudits(value: unknown, expectedProjectId: string): DeliveryAuditReport[] | undefined {
  const audits = validateOptional(value, validateDeliveryAuditReport, expectedProjectId, "Project delivery audit");
  if (!audits) return undefined;
  const generated = new Set<string>();
  for (const audit of audits) { if (generated.has(audit.generatedAt)) throw new Error(`Duplicate delivery audit timestamp \"${audit.generatedAt}\".`); generated.add(audit.generatedAt); }
  return audits;
}

function validateOptional<T>(value: unknown, validator: (item: T) => T, expectedProjectId: string, label: string): T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`Invalid ${label.toLowerCase()} state.`);
  const items = value as T[];
  const seen = new Set<string>();
  return items.map((item) => { const validated = validator(item) as T & { projectId?: unknown; id?: unknown }; if (validated.projectId !== expectedProjectId) throw new Error(`${label} belongs to another project.`); if (typeof validated.id === "string") { if (seen.has(validated.id)) throw new Error(`Duplicate ${label.toLowerCase()} id \"${validated.id}\".`); seen.add(validated.id); } return JSON.parse(JSON.stringify(validated)) as T; });
}

function validateBookCoverPlan(value: unknown): BookCoverPlan { if (!value || typeof value !== "object") throw new Error("Invalid book cover plan."); const plan = value as BookCoverPlan; validatePublishingConfiguration(plan.publishing); const expected = calculateKdpCoverLayout(plan.publishing); if (plan.formatVersion !== 1 || typeof plan.id !== "string" || typeof plan.projectId !== "string" || expected.dimensions.widthInches !== plan.dimensions.widthInches || expected.dimensions.heightInches !== plan.dimensions.heightInches) throw new Error("Invalid or corrupt book cover plan."); return cloneBookCoverPlan(plan); }
function validateBookGenome(value: unknown, expectedProjectId: string): BookGenome { if (!value || typeof value !== "object") throw new Error("Invalid Book Genome."); const candidate = value as BookGenome; if (candidate.projectId !== expectedProjectId) throw new Error("Book Genome belongs to another project."); if (candidate.formatVersion !== 1 || typeof candidate.generatedAt !== "string" || !Array.isArray(candidate.nodes)) throw new Error("Invalid or corrupt Book Genome."); return createBookGenome({ projectId: expectedProjectId, nodes: candidate.nodes, now: candidate.generatedAt }); }
function cloneMemory(memory: MemoryRecord): MemoryRecord { return { ...memory, provenance: memory.provenance.map((item) => ({ ...item })), relatedMemoryIds: [...memory.relatedMemoryIds], relevanceTags: [...memory.relevanceTags] }; }
function cloneCharacter(character: CharacterRecord): CharacterRecord { return validateCharacterRecord(JSON.parse(JSON.stringify(character))); }
function cloneVisualIdentity(identity: VisualCharacterIdentity): VisualCharacterIdentity { return validateVisualCharacterIdentity(JSON.parse(JSON.stringify(identity))); }
function cloneIllustrationAssetLibrary(library: IllustrationAssetLibraryState): IllustrationAssetLibraryState { return validateIllustrationAssetLibraryState(JSON.parse(JSON.stringify(library))); }
function cloneBookCoverPlan(plan: BookCoverPlan): BookCoverPlan { return JSON.parse(JSON.stringify(plan)) as BookCoverPlan; }
function isMissingFile(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"; }
function isUnsupportedDirectorySync(error: unknown): boolean { if (typeof error !== "object" || error === null || !("code" in error)) return false; return ["EINVAL", "ENOTSUP", "EPERM", "EISDIR"].includes(String((error as { code?: string }).code ?? "")); }
