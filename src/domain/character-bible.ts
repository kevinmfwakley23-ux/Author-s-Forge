export const CHARACTER_BIBLE_FORMAT_VERSION = 1 as const;

export const CHARACTER_FIELDS = [
  "name",
  "age",
  "birthDate",
  "physicalAppearance",
  "height",
  "build",
  "hair",
  "eyes",
  "skin",
  "clothing",
  "voice",
  "speechPatterns",
  "personality",
  "values",
  "fears",
  "secrets",
  "goals",
  "motivations",
  "relationships",
  "history",
  "knowledge",
  "skills",
  "weaknesses",
  "characterArc",
  "importantObjects",
  "currentEmotionalState",
  "currentLocation",
  "currentInjuries"
] as const;

export type CharacterField = typeof CHARACTER_FIELDS[number];

export interface CharacterRelationship {
  readonly characterId: string;
  readonly relationship: string;
  readonly status: string;
  readonly notes: string;
}

export interface CharacterProfile {
  readonly name: string;
  readonly age: number;
  readonly birthDate: string;
  readonly physicalAppearance: string;
  readonly height: string;
  readonly build: string;
  readonly hair: string;
  readonly eyes: string;
  readonly skin: string;
  readonly clothing: string;
  readonly voice: string;
  readonly speechPatterns: readonly string[];
  readonly personality: string;
  readonly values: readonly string[];
  readonly fears: readonly string[];
  readonly secrets: readonly string[];
  readonly goals: readonly string[];
  readonly motivations: readonly string[];
  readonly relationships: readonly CharacterRelationship[];
  readonly history: string;
  readonly knowledge: readonly string[];
  readonly skills: readonly string[];
  readonly weaknesses: readonly string[];
  readonly characterArc: string;
  readonly importantObjects: readonly string[];
  readonly currentEmotionalState: string;
  readonly currentLocation: string;
  readonly currentInjuries: readonly string[];
}

export type CharacterFieldValue = CharacterProfile[CharacterField];

export interface CharacterFieldVersion<F extends CharacterField = CharacterField> {
  readonly field: F;
  readonly value: CharacterProfile[F];
  readonly effectiveAt: string;
  readonly sequence: number;
  readonly reason: string;
  readonly actor: "author" | "system";
}

export interface CharacterChange {
  readonly field: CharacterField;
  readonly previousValue: CharacterFieldValue;
  readonly nextValue: CharacterFieldValue;
  readonly effectiveAt: string;
  readonly sequence: number;
  readonly reason: string;
  readonly actor: "author" | "system";
}

export interface CharacterRecord {
  readonly formatVersion: typeof CHARACTER_BIBLE_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly profile: CharacterProfile;
  readonly fieldHistory: Readonly<{ [F in CharacterField]: readonly CharacterFieldVersion<F>[] }>;
}

export type CharacterProfileUpdate = Partial<CharacterProfile>;

export interface CharacterUpdateInput {
  readonly characterId: string;
  readonly changes: CharacterProfileUpdate;
  readonly effectiveAt?: string;
  readonly reason: string;
  readonly actor?: "author" | "system";
}

export function createCharacter(input: {
  id: string;
  projectId: string;
  profile: CharacterProfile;
  now?: string;
  reason?: string;
  actor?: "author" | "system";
}): CharacterRecord {
  assertIdentifier(input.id, "Character id");
  assertIdentifier(input.projectId, "Character project id");
  const now = validateTimestamp(input.now ?? new Date().toISOString(), "Character timestamp");
  const reason = requireText(input.reason ?? "Initial character bible entry", "Character history reason");
  const actor = input.actor ?? "author";
  const profile = normalizeProfile(input.profile);
  const fieldHistory = {} as { [F in CharacterField]: CharacterFieldVersion<F>[] };

  for (const field of CHARACTER_FIELDS) {
    fieldHistory[field] = [{
      field,
      value: cloneFieldValue(field, profile[field]),
      effectiveAt: now,
      sequence: 1,
      reason,
      actor
    }] as CharacterFieldVersion<typeof field>[];
  }

  return {
    formatVersion: CHARACTER_BIBLE_FORMAT_VERSION,
    id: input.id,
    projectId: input.projectId,
    createdAt: now,
    updatedAt: now,
    profile: cloneProfile(profile),
    fieldHistory: cloneFieldHistory(fieldHistory)
  };
}

export function updateCharacter(character: CharacterRecord, input: CharacterUpdateInput): CharacterRecord {
  if (character.id !== input.characterId) throw new Error("Character update id does not match the character.");
  const effectiveAt = validateTimestamp(input.effectiveAt ?? new Date().toISOString(), "Character update timestamp");
  const reason = requireText(input.reason, "Character update reason");
  const actor = input.actor ?? "author";
  const changes = input.changes as Record<string, unknown>;
  const keys = Object.keys(changes);
  for (const key of keys) {
    if (!(CHARACTER_FIELDS as readonly string[]).includes(key)) throw new Error(`Unsupported character field "${key}".`);
  }
  if (keys.length === 0) throw new Error("Character update requires at least one field change.");

  const nextProfile = cloneProfile(character.profile);
  const nextHistory = cloneFieldHistory(character.fieldHistory);
  const nextSequence = highestSequence(character) + 1;
  const changed: CharacterField[] = [];

  for (const field of CHARACTER_FIELDS) {
    if (!(field in changes)) continue;
    const normalized = normalizeField(field, changes[field] as CharacterFieldValue);
    if (valuesEqual(nextProfile[field], normalized)) continue;
    (nextProfile as MutableProfile)[field] = cloneFieldValue(field, normalized) as never;
    nextHistory[field].push({
      field,
      value: cloneFieldValue(field, normalized),
      effectiveAt,
      sequence: nextSequence,
      reason,
      actor
    } as never);
    changed.push(field);
  }

  if (changed.length === 0) throw new Error("Character update does not change any character field.");

  return {
    ...character,
    updatedAt: effectiveAt > character.updatedAt ? effectiveAt : character.updatedAt,
    profile: cloneProfile(nextProfile),
    fieldHistory: cloneFieldHistory(nextHistory)
  };
}

export function getCharacterAt(character: CharacterRecord, asOf: string): CharacterProfile {
  const timestamp = validateTimestamp(asOf, "Character historical timestamp");
  const profile = {} as MutableProfile;
  for (const field of CHARACTER_FIELDS) {
    const versions = character.fieldHistory[field];
    let selected: CharacterFieldVersion<typeof field> | undefined;
    for (const version of versions) {
      if (version.effectiveAt > timestamp) continue;
      if (!selected || version.effectiveAt < selected.effectiveAt || (version.effectiveAt === selected.effectiveAt && version.sequence > selected.sequence)) selected = version;
    }
    if (!selected) throw new Error(`Character field "${field}" did not exist at ${timestamp}.`);
    profile[field] = cloneFieldValue(field, selected.value) as never;
  }
  return cloneProfile(profile);
}

export function getCharacterFieldHistory<F extends CharacterField>(character: CharacterRecord, field: F): readonly CharacterFieldVersion<F>[] {
  return character.fieldHistory[field].map((version) => ({ ...version, value: cloneFieldValue(field, version.value) })) as readonly CharacterFieldVersion<F>[];
}

export function getCharacterChanges(character: CharacterRecord): readonly CharacterChange[] {
  const changes: CharacterChange[] = [];
  for (const field of CHARACTER_FIELDS) {
    const versions = character.fieldHistory[field];
    for (let index = 1; index < versions.length; index += 1) {
      const previous = versions[index - 1];
      const current = versions[index];
      changes.push({
        field,
        previousValue: cloneFieldValue(field, previous.value),
        nextValue: cloneFieldValue(field, current.value),
        effectiveAt: current.effectiveAt,
        sequence: current.sequence,
        reason: current.reason,
        actor: current.actor
      } as CharacterChange);
    }
  }
  return changes.sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt) || a.sequence - b.sequence || a.field.localeCompare(b.field));
}

export function validateCharacterRecord(value: unknown): CharacterRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid character record.");
  const candidate = value as Record<string, unknown>;
  if (candidate.formatVersion !== CHARACTER_BIBLE_FORMAT_VERSION || typeof candidate.id !== "string" || typeof candidate.projectId !== "string") throw new Error("Unsupported or corrupt character record.");
  if (!candidate.profile || typeof candidate.profile !== "object") throw new Error("Character profile is required.");
  const profile = normalizeProfile(candidate.profile as CharacterProfile);
  if (!candidate.fieldHistory || typeof candidate.fieldHistory !== "object") throw new Error("Character field history is required.");
  const history = candidate.fieldHistory as Partial<{ [F in CharacterField]: readonly CharacterFieldVersion<F>[] }>;
  for (const field of CHARACTER_FIELDS) {
    const versions = history[field];
    if (!Array.isArray(versions) || versions.length === 0) throw new Error(`Character field history is missing "${field}".`);
    for (const version of versions) {
      if (version.field !== field || typeof version.effectiveAt !== "string" || !Number.isInteger(version.sequence) || version.sequence < 1 || typeof version.reason !== "string" || (version.actor !== "author" && version.actor !== "system")) throw new Error(`Invalid history entry for character field "${field}".`);
      validateTimestamp(version.effectiveAt, `Character field "${field}" timestamp`);
      normalizeField(field, version.value);
    }
  }
  return createCharacterFromValidated(candidate, profile, history as { [F in CharacterField]: readonly CharacterFieldVersion<F>[] });
}

type MutableProfile = { -readonly [F in CharacterField]: CharacterProfile[F] };

function createCharacterFromValidated(candidate: Record<string, unknown>, profile: CharacterProfile, history: { [F in CharacterField]: readonly CharacterFieldVersion<F>[] }): CharacterRecord {
  const createdAt = validateTimestamp(String(candidate.createdAt), "Character createdAt");
  const updatedAt = validateTimestamp(String(candidate.updatedAt), "Character updatedAt");
  return {
    formatVersion: CHARACTER_BIBLE_FORMAT_VERSION,
    id: String(candidate.id),
    projectId: String(candidate.projectId),
    createdAt,
    updatedAt,
    profile: cloneProfile(profile),
    fieldHistory: cloneFieldHistory(history)
  };
}

function normalizeProfile(profile: CharacterProfile): CharacterProfile {
  const normalized = {} as MutableProfile;
  for (const field of CHARACTER_FIELDS) normalized[field] = normalizeField(field, profile[field]) as never;
  return cloneProfile(normalized);
}

function normalizeField<F extends CharacterField>(field: F, value: CharacterProfile[F]): CharacterProfile[F] {
  if (field === "age") {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error("Character age must be a non-negative integer.");
    return value as CharacterProfile[F];
  }
  if (field === "relationships") {
    if (!Array.isArray(value)) throw new Error("Character relationships must be an array.");
    return value.map((relationship) => {
      if (!relationship || typeof relationship !== "object") throw new Error("Character relationship must be an object.");
      const item = relationship as CharacterRelationship;
      return {
        characterId: requireText(item.characterId, "Relationship character id"),
        relationship: requireText(item.relationship, "Relationship type"),
        status: requireText(item.status, "Relationship status"),
        notes: requireText(item.notes, "Relationship notes")
      };
    }) as CharacterProfile[F];
  }
  if (field === "speechPatterns" || field === "values" || field === "fears" || field === "secrets" || field === "goals" || field === "motivations" || field === "knowledge" || field === "skills" || field === "weaknesses" || field === "importantObjects" || field === "currentInjuries") {
    if (!Array.isArray(value)) throw new Error(`Character ${field} must be an array.`);
    return normalizeStringArray(value, field) as CharacterProfile[F];
  }
  if (typeof value !== "string") throw new Error(`Character ${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`Character ${field} is required.`);
  if (field === "birthDate" && Number.isNaN(Date.parse(trimmed))) throw new Error("Character birth date must be a valid date.");
  return trimmed as CharacterProfile[F];
}

function normalizeStringArray(value: readonly unknown[], field: string): readonly string[] {
  return [...new Set(value.map((item) => {
    if (typeof item !== "string") throw new Error(`Character ${field} entries must be strings.`);
    return requireText(item, `Character ${field} entry`);
  }))];
}

function cloneProfile(profile: CharacterProfile): CharacterProfile {
  return {
    ...profile,
    speechPatterns: [...profile.speechPatterns], values: [...profile.values], fears: [...profile.fears], secrets: [...profile.secrets], goals: [...profile.goals], motivations: [...profile.motivations],
    relationships: profile.relationships.map((relationship) => ({ ...relationship })), knowledge: [...profile.knowledge], skills: [...profile.skills], weaknesses: [...profile.weaknesses], importantObjects: [...profile.importantObjects], currentInjuries: [...profile.currentInjuries]
  };
}

function cloneFieldValue<F extends CharacterField>(field: F, value: CharacterProfile[F]): CharacterProfile[F] {
  if (field === "relationships") return (value as readonly CharacterRelationship[]).map((item) => ({ ...item })) as CharacterProfile[F];
  if (Array.isArray(value)) return [...value] as CharacterProfile[F];
  return value;
}

function cloneFieldHistory(history: { [F in CharacterField]: readonly CharacterFieldVersion<F>[] }): { [F in CharacterField]: readonly CharacterFieldVersion<F>[] } {
  const result = {} as { [F in CharacterField]: readonly CharacterFieldVersion<F>[] };
  for (const field of CHARACTER_FIELDS) result[field] = history[field].map((version) => ({ ...version, value: cloneFieldValue(field, version.value) })) as readonly CharacterFieldVersion<typeof field>[];
  return result;
}

function valuesEqual(a: CharacterFieldValue, b: CharacterFieldValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function highestSequence(character: CharacterRecord): number {
  return Math.max(...CHARACTER_FIELDS.flatMap((field) => character.fieldHistory[field].map((version) => version.sequence)));
}

function assertIdentifier(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} is required.`);
}

function requireText(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function validateTimestamp(value: string, label: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a valid timestamp.`);
  return new Date(value).toISOString();
}
