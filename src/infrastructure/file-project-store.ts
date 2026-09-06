import { validateMemoryRecord, type MemoryRecord } from "../domain/memory";
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
import { validatePublishingReadinessReport } from "../domain/publishing-readiness";
import { validateKdpMarketIntelligenceReport } from "../domain/kdp-market-intelligence";
import { validateBookPositioningReport } from "../domain/book-positioning";
import { createAuthorGoal, type AuthorGoal } from "../domain/author-goals";
import { validateStudioWorkspace, type StudioWorkspaceState } from "../domain/studio-workspace";
import { validateBookSnapshot, type BookVersionHistory } from "../domain/book-version-control";
import { validateAuthorDecision, type AuthorDecision } from "../domain/author-control";
import { validateSeriesState, type SeriesState } from "../domain/series";
import type { VoiceFingerprint, VoiceProfile } from "../domain/voice-preservation";
import { AUTHOR_VOICE_MEMORY_FORMAT_VERSION, type AuthorVoiceMemory } from "../domain/author-voice-memory";
import { validateAiCollaborationPolicy, type AiCollaborationPolicy } from "../domain/ai-collaboration";
import { validateProjectHealthReport, type ProjectHealthReport } from "../domain/project-health";
import { validateMemoryRelationship, type MemoryRelationship } from "../domain/relationship-memory";
import { validateDeliveryAuditReport, type DeliveryAuditReport } from "../domain/delivery-audit";
import { randomUUID } from "node:crypto";
import { access, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

const LEGACY_PROJECT_FORMAT_VERSION = 2 as const;
const NARRATIVE_DISTANCES = new Set(["first-person", "second-person", "third-person", "mixed", "undetermined"]);
const VOICE_PURPOSES = new Set(["prose", "dialogue", "description", "narration", "other"]);
const VOICE_SOURCES = new Set(["author", "approved-manuscript"]);
const VOICE_EVENT_TYPES = new Set(["sample-added", "sample-removed", "canonical-set"]);

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
    if (!project || typeof project !== "object" || !project.metadata || typeof project.metadata.id !== "string") throw new Error("Invalid project package.");
    const validated = this.validate(project, project.metadata.id);
    const path = this.projectPath(validated.metadata.id);
    const directory = dirname(path);
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
      await unlink(temporaryPath).catch((cleanupError) => {
        if (!isMissingFile(cleanupError)) throw cleanupError;
      });
      throw error;
    }
  }
  public async exists(projectId: string): Promise<boolean> {
    try { await access(this.projectPath(projectId)); return true; }
    catch (error) { if (isMissingFile(error)) return false; throw error; }
  }
  private projectPath(projectId: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Project id contains unsupported path characters.");
    return join(this.rootDirectory, "projects", projectId, "project.json");
  }
  private validate(value: unknown, expectedId: string): ProjectState {
    if (!value || typeof value !== "object") throw new Error("Invalid project package.");
    const candidate = value as Record<string, unknown>;
    if (candidate.formatVersion !== 1 && candidate.formatVersion !== LEGACY_PROJECT_FORMAT_VERSION && candidate.formatVersion !== PROJECT_FORMAT_VERSION) throw new Error("Unsupported or corrupt project package.");
    const metadata = validateProjectMetadata(candidate.metadata, expectedId, candidate.formatVersion);
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
    const authorDecisions = validateOptionalAuthorDecisions(candidate.authorDecisions, expectedId);
    const series = validateOptionalSeries(candidate.series, expectedId);
    const voiceProfiles = validateOptionalVoiceProfiles(candidate.voiceProfiles, expectedId);
    const authorVoiceMemory = candidate.authorVoiceMemory === undefined ? undefined : validateProjectAuthorVoiceMemory(candidate.authorVoiceMemory, expectedId);
    const aiCollaborationPolicy = candidate.aiCollaborationPolicy === undefined ? undefined : validateAiCollaborationPolicy(candidate.aiCollaborationPolicy as AiCollaborationPolicy);
    const projectHealthReports = validateOptionalProjectHealthReports(candidate.projectHealthReports, expectedId);
    const memoryRelationships = validateOptionalMemoryRelationships(candidate.memoryRelationships, expectedId);
    const deliveryAudits = validateOptionalDeliveryAudits(candidate.deliveryAudits, expectedId);
    const bookGenome = candidate.bookGenome === undefined ? undefined : validateBookGenome(candidate.bookGenome, expectedId);

    const normalized = JSON.parse(JSON.stringify(candidate)) as Record<string, unknown>;
    normalized.formatVersion = PROJECT_FORMAT_VERSION;
    normalized.metadata = metadata;
    normalized.memories = memories.map(cloneMemory);
    if (studioWorkspace) normalized.studioWorkspace = validateStudioWorkspace(JSON.parse(JSON.stringify(studioWorkspace)));
    if (authorGoals) normalized.authorGoals = authorGoals.map((goal) => ({ ...goal }));
    if (characters) normalized.characters = characters;
    if (characterStateMemories) normalized.characterStateMemories = clone(characterStateMemories);
    if (visualIdentities) normalized.visualIdentities = visualIdentities;
    if (illustrationAssetLibrary) normalized.illustrationAssetLibrary = cloneIllustrationAssetLibrary(illustrationAssetLibrary);
    if (bookCoverPlans) normalized.bookCoverPlans = bookCoverPlans;
    if (publishingReadinessReports) normalized.publishingReadinessReports = publishingReadinessReports;
    if (kdpMarketIntelligenceReports) normalized.kdpMarketIntelligenceReports = kdpMarketIntelligenceReports;
    if (bookPositioningReports) normalized.bookPositioningReports = bookPositioningReports;
    if (bookVersionHistories) normalized.bookVersionHistories = clone(bookVersionHistories);
    if (authorDecisions) normalized.authorDecisions = clone(authorDecisions);
    if (series) normalized.series = clone(series);
    if (voiceProfiles) normalized.voiceProfiles = clone(voiceProfiles);
    if (authorVoiceMemory) normalized.authorVoiceMemory = clone(authorVoiceMemory);
    if (aiCollaborationPolicy) normalized.aiCollaborationPolicy = { ...aiCollaborationPolicy };
    if (projectHealthReports) normalized.projectHealthReports = clone(projectHealthReports);
    if (memoryRelationships) normalized.memoryRelationships = clone(memoryRelationships);
    if (deliveryAudits) normalized.deliveryAudits = clone(deliveryAudits);
    if (bookGenome) normalized.bookGenome = bookGenome;
    return normalized as unknown as ProjectState;
  }
}

function validateProjectMetadata(value: unknown, expectedId: string, formatVersion: unknown): ProjectState["metadata"] {
  if (!value || typeof value !== "object") throw new Error("Invalid project metadata.");
  const record = value as Record<string, unknown>;
  if (record.id !== expectedId || typeof record.title !== "string" || !record.title.trim()) throw new Error("Unsupported or corrupt project package.");
  const createdAt = requiredTimestamp(record.createdAt, "Project createdAt");
  const updatedAt = requiredTimestamp(record.updatedAt, "Project updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Project updatedAt cannot precede createdAt.");
  const status = record.status === undefined && formatVersion !== PROJECT_FORMAT_VERSION ? "active" : record.status;
  if (status !== "active" && status !== "archived") throw new Error("Invalid project status.");
  return { id: expectedId, title: record.title.trim(), createdAt, updatedAt, status };
}

function validateProjectMemories(value: unknown, expectedProjectId: string): MemoryRecord[] {
  const memories = value === undefined ? [] : value;
  if (!Array.isArray(memories)) throw new Error("Invalid project memory state.");
  const ids = new Set<string>();
  return memories.map((raw) => {
    validateMemoryRecord(raw as MemoryRecord);
    const memory = raw as MemoryRecord;
    if (memory.projectId !== expectedProjectId) throw new Error("Project memory state contains a memory from another project.");
    if (ids.has(memory.id)) throw new Error(`Duplicate memory id \"${memory.id}\" in project state.`);
    ids.add(memory.id);
    return cloneMemory(memory);
  });
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
  return value.map((character) => {
    const validated = validateCharacterRecord(character);
    if (validated.projectId !== expectedProjectId) throw new Error("Project character state contains a character from another project.");
    if (ids.has(validated.id)) throw new Error(`Duplicate character id \"${validated.id}\" in project state.`);
    ids.add(validated.id);
    return cloneCharacter(validated);
  });
}
function validateOptionalCharacterStateMemories(value: unknown, expectedProjectId: string, characters: readonly CharacterRecord[]): CharacterStateMemory[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project character state memory.");
  const characterIds = new Set(characters.map((character) => character.id));
  const seen = new Set<string>();
  return value.map((raw) => {
    const validated = validateCharacterStateMemory(raw);
    if (validated.projectId !== expectedProjectId) throw new Error("Project character state memory belongs to another project.");
    if (!characterIds.has(validated.characterId)) throw new Error(`Character state memory references missing character \"${validated.characterId}\".`);
    if (seen.has(validated.characterId)) throw new Error(`Duplicate character state memory for \"${validated.characterId}\".`);
    seen.add(validated.characterId);
    return clone(validated);
  });
}
function validateOptionalVisualIdentities(value: unknown, expectedProjectId: string): VisualCharacterIdentity[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project visual identity state.");
  const ids = new Set<string>(); const characters = new Set<string>();
  return value.map((identity) => {
    const validated = validateVisualCharacterIdentity(identity);
    if (validated.projectId !== expectedProjectId) throw new Error("Project visual identity state contains an identity from another project.");
    if (ids.has(validated.id)) throw new Error(`Duplicate visual identity id \"${validated.id}\" in project state.`);
    if (characters.has(validated.characterId)) throw new Error(`Duplicate visual identity for character \"${validated.characterId}\" in project state.`);
    ids.add(validated.id); characters.add(validated.characterId);
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
function validateOptional<T>(value: unknown, validator: (item: T) => T, expectedProjectId: string, label: string): T[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`Invalid ${label.toLowerCase()} state.`);
  const items = value as T[];
  const seen = new Set<string>();
  return items.map((item) => {
    const validated = validator(item) as T & { projectId?: unknown; id?: unknown };
    if (validated.projectId !== expectedProjectId) throw new Error(`${label} belongs to another project.`);
    if (typeof validated.id === "string") {
      if (seen.has(validated.id)) throw new Error(`Duplicate ${label.toLowerCase()} id \"${validated.id}\".`);
      seen.add(validated.id);
    }
    return clone(validated as T);
  });
}
function validateOptionalBookVersionHistories(value: unknown, expectedProjectId: string): BookVersionHistory[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project book version history state.");
  const books = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid project book version history.");
    const history = raw as BookVersionHistory;
    if (history.projectId !== expectedProjectId || typeof history.bookId !== "string" || !history.bookId.trim() || !Array.isArray(history.versions) || !Array.isArray(history.branches)) throw new Error("Invalid project book version history.");
    if (books.has(history.bookId)) throw new Error(`Duplicate version history for book \"${history.bookId}\".`);
    books.add(history.bookId);
    const versionIds = new Set<string>();
    const versions = history.versions.map((version) => {
      const validated = validateBookSnapshot(version);
      if (validated.projectId !== expectedProjectId || validated.bookId !== history.bookId) throw new Error("Version history contains an incorrectly scoped version.");
      if (versionIds.has(validated.id)) throw new Error(`Duplicate book version id \"${validated.id}\".`);
      versionIds.add(validated.id);
      return validated;
    });
    for (const version of versions) if (version.parentId && !versionIds.has(version.parentId)) throw new Error(`Book version \"${version.id}\" references missing parent \"${version.parentId}\".`);
    const branchIds = new Set<string>(); const branchNames = new Set<string>();
    const branches = history.branches.map((branch) => {
      if (!branch || typeof branch !== "object" || typeof branch.id !== "string" || !branch.id.trim() || branch.projectId !== expectedProjectId || branch.bookId !== history.bookId || typeof branch.name !== "string" || !branch.name.trim() || typeof branch.createdAt !== "string" || Number.isNaN(Date.parse(branch.createdAt)) || !versionIds.has(branch.baseVersionId) || !versionIds.has(branch.headVersionId)) throw new Error("Invalid project book version branch.");
      if (branchIds.has(branch.id)) throw new Error(`Duplicate book version branch id \"${branch.id}\".`);
      if (branchNames.has(branch.name.trim())) throw new Error(`Duplicate book version branch name \"${branch.name.trim()}\".`);
      branchIds.add(branch.id); branchNames.add(branch.name.trim());
      return clone(branch);
    });
    return { projectId: expectedProjectId, bookId: history.bookId, versions, branches };
  });
}
function validateOptionalAuthorDecisions(value: unknown, expectedProjectId: string): AuthorDecision[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project author decision state.");
  const ids = new Set<string>();
  const decisions = value.map((raw) => {
    const validated = validateAuthorDecision(raw as AuthorDecision);
    if (validated.projectId !== expectedProjectId) throw new Error("Project author decision belongs to another project.");
    if (typeof validated.reason !== "string" || !validated.reason.trim()) throw new Error("Decision reason is required.");
    requiredTimestamp(validated.createdAt, "Decision createdAt");
    if (ids.has(validated.id)) throw new Error(`Duplicate author decision id \"${validated.id}\".`);
    ids.add(validated.id);
    return validated;
  });
  const byId = new Map(decisions.map((decision) => [decision.id, decision]));
  for (const decision of decisions) {
    if (!decision.supersedesId) continue;
    const prior = byId.get(decision.supersedesId);
    if (!prior || prior.projectId !== expectedProjectId || prior.targetId !== decision.targetId) throw new Error(`Author decision \"${decision.id}\" has an invalid supersedes link.`);
  }
  return decisions;
}
function validateOptionalSeries(value: unknown, expectedProjectId: string): SeriesState[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project series state.");
  const ids = new Set<string>();
  return value.map((raw) => {
    const validated = validateSeriesState(raw as SeriesState);
    if (validated.projectId !== expectedProjectId) throw new Error("Project series belongs to another project.");
    if (ids.has(validated.id)) throw new Error(`Duplicate series id \"${validated.id}\".`);
    ids.add(validated.id);
    const eventIds = new Set<string>();
    for (const event of validated.timeline) {
      if (eventIds.has(event.id)) throw new Error(`Duplicate series timeline event id \"${event.id}\".`);
      eventIds.add(event.id);
      if (!validated.bookIds.includes(event.bookId)) throw new Error(`Series timeline event references book \"${event.bookId}\" outside the series.`);
    }
    return validated;
  });
}
function validateOptionalVoiceProfiles(value: unknown, expectedProjectId: string): VoiceProfile[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project voice profile state.");
  const ids = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid project voice profile.");
    const profile = raw as VoiceProfile;
    if (profile.projectId !== expectedProjectId || !requiredString(profile.id, "Voice profile id") || !requiredString(profile.authorId, "Voice profile author id")) throw new Error("Invalid project voice profile.");
    requiredTimestamp(profile.createdAt, "Voice profile createdAt");
    if (!Array.isArray(profile.sampleIds) || profile.sampleIds.some((id) => typeof id !== "string" || !id.trim()) || new Set(profile.sampleIds).size !== profile.sampleIds.length) throw new Error("Voice profile sample ids are invalid.");
    validateVoiceFingerprint(profile.fingerprint, "Voice profile fingerprint");
    if (ids.has(profile.id)) throw new Error(`Duplicate voice profile id \"${profile.id}\".`);
    ids.add(profile.id);
    return clone(profile);
  });
}
function validateProjectAuthorVoiceMemory(value: unknown, expectedProjectId: string): AuthorVoiceMemory {
  if (!value || typeof value !== "object") throw new Error("Invalid project author voice memory.");
  const memory = value as AuthorVoiceMemory;
  if (memory.formatVersion !== AUTHOR_VOICE_MEMORY_FORMAT_VERSION || memory.projectId !== expectedProjectId) throw new Error("Invalid project author voice memory.");
  requiredString(memory.id, "Author voice memory id"); requiredString(memory.authorId, "Author voice memory author id");
  const createdAt = requiredTimestamp(memory.createdAt, "Author voice memory createdAt");
  const updatedAt = requiredTimestamp(memory.updatedAt, "Author voice memory updatedAt");
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new Error("Author voice memory updatedAt cannot precede createdAt.");
  if (!Array.isArray(memory.samples) || memory.samples.length === 0) throw new Error("Project author voice memory requires at least one sample.");
  const sampleIds = new Set<string>();
  for (const sample of memory.samples) {
    requiredString(sample.id, "Author voice sample id"); requiredString(sample.label, "Author voice sample label"); requiredString(sample.text, "Author voice sample text");
    if (sampleIds.has(sample.id)) throw new Error(`Duplicate author voice sample id \"${sample.id}\".`);
    sampleIds.add(sample.id);
    if (typeof sample.approved !== "boolean" || !Number.isFinite(sample.weight) || sample.weight < 0 || !VOICE_SOURCES.has(sample.source) || (sample.purpose !== undefined && !VOICE_PURPOSES.has(sample.purpose))) throw new Error(`Invalid author voice sample \"${sample.id}\".`);
    validateVoiceFingerprint(sample.fingerprint, `Author voice sample \"${sample.id}\" fingerprint`);
  }
  if (!Array.isArray(memory.canonicalSampleIds) || new Set(memory.canonicalSampleIds).size !== memory.canonicalSampleIds.length) throw new Error("Author voice canonical sample ids are invalid.");
  for (const id of memory.canonicalSampleIds) if (!sampleIds.has(id)) throw new Error(`Canonical author voice sample \"${id}\" is missing from the project corpus.`);
  validateVoiceFingerprint(memory.fingerprint, "Author voice aggregate fingerprint");
  validateVoiceDimensions(memory.dimensions);
  if (!Array.isArray(memory.evolution)) throw new Error("Author voice evolution must be an array.");
  const eventIds = new Set<string>();
  for (const item of memory.evolution) {
    requiredString(item.id, "Author voice evolution id"); requiredTimestamp(item.at, "Author voice evolution timestamp"); requiredString(item.reason, "Author voice evolution reason");
    if (!VOICE_EVENT_TYPES.has(item.type) || !Array.isArray(item.sampleIds) || item.sampleIds.some((id) => typeof id !== "string" || !id.trim())) throw new Error(`Invalid author voice evolution event \"${item.id}\".`);
    if (eventIds.has(item.id)) throw new Error(`Duplicate author voice evolution event id \"${item.id}\".`);
    eventIds.add(item.id);
  }
  return clone(memory);
}
function validateOptionalProjectHealthReports(value: unknown, expectedProjectId: string): ProjectHealthReport[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project health report state.");
  const timestamps = new Set<string>();
  return value.map((raw) => {
    const validated = validateProjectHealthReport(raw as ProjectHealthReport);
    if (validated.projectId !== expectedProjectId) throw new Error("Project health report belongs to another project.");
    requiredTimestamp(validated.generatedAt, "Project health generatedAt");
    if (timestamps.has(validated.generatedAt)) throw new Error(`Duplicate project health report timestamp \"${validated.generatedAt}\".`);
    timestamps.add(validated.generatedAt);
    return clone(validated);
  });
}
function validateOptionalMemoryRelationships(value: unknown, expectedProjectId: string): MemoryRelationship[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project memory relationship state.");
  const ids = new Set<string>();
  return value.map((raw) => {
    const validated = validateMemoryRelationship(raw as MemoryRelationship);
    if (validated.projectId !== expectedProjectId) throw new Error("Project memory relationship belongs to another project.");
    requiredTimestamp(validated.createdAt, "Memory relationship createdAt");
    if (ids.has(validated.id)) throw new Error(`Duplicate memory relationship id \"${validated.id}\".`);
    ids.add(validated.id);
    return clone(validated);
  });
}
function validateOptionalDeliveryAudits(value: unknown, expectedProjectId: string): DeliveryAuditReport[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("Invalid project delivery audit state.");
  const timestamps = new Set<string>();
  return value.map((raw) => {
    const validated = validateDeliveryAuditReport(raw as DeliveryAuditReport);
    if (validated.projectId !== expectedProjectId) throw new Error("Project delivery audit belongs to another project.");
    requiredTimestamp(validated.generatedAt, "Delivery audit generatedAt");
    if (timestamps.has(validated.generatedAt)) throw new Error(`Duplicate delivery audit timestamp \"${validated.generatedAt}\".`);
    timestamps.add(validated.generatedAt);
    return clone(validated);
  });
}
function validateBookCoverPlan(value: unknown): BookCoverPlan {
  if (!value || typeof value !== "object") throw new Error("Invalid book cover plan.");
  const plan = value as BookCoverPlan;
  validatePublishingConfiguration(plan.publishing);
  const expected = calculateKdpCoverLayout(plan.publishing);
  if (plan.formatVersion !== 1 || typeof plan.id !== "string" || typeof plan.projectId !== "string" || expected.dimensions.widthInches !== plan.dimensions.widthInches || expected.dimensions.heightInches !== plan.dimensions.heightInches) throw new Error("Invalid or corrupt book cover plan.");
  return cloneBookCoverPlan(plan);
}
function validateBookGenome(value: unknown, expectedProjectId: string): BookGenome {
  if (!value || typeof value !== "object") throw new Error("Invalid Book Genome.");
  const candidate = value as BookGenome;
  if (candidate.projectId !== expectedProjectId) throw new Error("Book Genome belongs to another project.");
  if (candidate.formatVersion !== 1 || typeof candidate.generatedAt !== "string" || !Array.isArray(candidate.nodes)) throw new Error("Invalid or corrupt Book Genome.");
  return createBookGenome({ projectId: expectedProjectId, nodes: candidate.nodes, now: candidate.generatedAt });
}
function validateVoiceFingerprint(value: VoiceFingerprint, label: string): void {
  if (!value || typeof value !== "object") throw new Error(`${label} is invalid.`);
  const nonNegative = [value.sentenceLengthMean, value.sentenceLengthMedian, value.paragraphLengthMean];
  if (nonNegative.some((number) => !Number.isFinite(number) || number < 0)) throw new Error(`${label} contains invalid length metrics.`);
  const ratios = [value.punctuationRate, value.dialogueRatio, value.vocabularyRichness, value.descriptionDensity, value.metaphorDensity, value.pacing, value.emotionalIntensity];
  if (ratios.some((number) => !Number.isFinite(number) || number < 0 || number > 1)) throw new Error(`${label} contains invalid ratio metrics.`);
  if (!Number.isInteger(value.sampleWordCount) || value.sampleWordCount < 0 || !NARRATIVE_DISTANCES.has(value.narrativeDistance)) throw new Error(`${label} contains invalid sample metadata.`);
}
function validateVoiceDimensions(value: AuthorVoiceMemory["dimensions"]): void {
  if (!value || typeof value !== "object") throw new Error("Author voice dimensions are invalid.");
  for (const score of Object.values(value)) if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error("Author voice dimensions must be finite scores from 0 to 1.");
}
function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function requiredTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`);
  return value;
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function cloneMemory(memory: MemoryRecord): MemoryRecord { return { ...memory, provenance: memory.provenance.map((item) => ({ ...item })), relatedMemoryIds: [...memory.relatedMemoryIds], relevanceTags: [...memory.relevanceTags] }; }
function cloneCharacter(character: CharacterRecord): CharacterRecord { return validateCharacterRecord(JSON.parse(JSON.stringify(character))); }
function cloneVisualIdentity(identity: VisualCharacterIdentity): VisualCharacterIdentity { return validateVisualCharacterIdentity(JSON.parse(JSON.stringify(identity))); }
function cloneIllustrationAssetLibrary(library: IllustrationAssetLibraryState): IllustrationAssetLibraryState { return validateIllustrationAssetLibraryState(JSON.parse(JSON.stringify(library))); }
function cloneBookCoverPlan(plan: BookCoverPlan): BookCoverPlan { return clone(plan); }
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
function isMissingFile(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT"; }
function isUnsupportedDirectorySync(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return ["EINVAL", "ENOTSUP", "EPERM", "EISDIR"].includes(String((error as { code?: string }).code ?? ""));
}
