import type { CharacterProfile, CharacterRecord } from "./character-bible";

export const CHARACTER_STATE_MEMORY_FORMAT_VERSION = 1 as const;

export interface CharacterSceneState {
  readonly characterId: string;
  readonly projectId: string;
  readonly sceneId: string;
  readonly sequence: number;
  readonly capturedAt: string;
  readonly profile: CharacterProfile;
  readonly changedFields: readonly string[];
  readonly source: "author" | "approved-system";
}

export interface CharacterStateMemory {
  readonly formatVersion: typeof CHARACTER_STATE_MEMORY_FORMAT_VERSION;
  readonly characterId: string;
  readonly projectId: string;
  readonly snapshots: readonly CharacterSceneState[];
}

export interface CharacterStateMemoryQuery {
  readonly sceneId?: string;
  readonly asOf?: string;
  readonly includeHistory?: boolean;
}

export function createCharacterStateMemory(character: CharacterRecord): CharacterStateMemory {
  return { formatVersion: CHARACTER_STATE_MEMORY_FORMAT_VERSION, characterId: character.id, projectId: character.projectId, snapshots: [] };
}

export function captureCharacterSceneState(
  memory: CharacterStateMemory,
  character: CharacterRecord,
  input: { sceneId: string; capturedAt?: string; source?: "author" | "approved-system"; changedFields?: readonly string[] },
): CharacterStateMemory {
  if (memory.characterId !== character.id || memory.projectId !== character.projectId) throw new Error("Character state memory does not belong to the character.");
  if (!input.sceneId.trim()) throw new Error("Character scene state requires a scene id.");
  const capturedAt = new Date(input.capturedAt ?? new Date().toISOString());
  if (Number.isNaN(capturedAt.getTime())) throw new Error("Character scene state timestamp is invalid.");
  const snapshots = memory.snapshots.filter((snapshot) => snapshot.sceneId !== input.sceneId);
  const sequence = snapshots.reduce((max, snapshot) => Math.max(max, snapshot.sequence), 0) + 1;
  const snapshot: CharacterSceneState = {
    characterId: character.id,
    projectId: character.projectId,
    sceneId: input.sceneId.trim(),
    sequence,
    capturedAt: capturedAt.toISOString(),
    profile: cloneProfile(character.profile),
    changedFields: [...new Set((input.changedFields ?? []).map((field) => field.trim()).filter(Boolean))],
    source: input.source ?? "author",
  };
  return { ...memory, snapshots: [...snapshots, snapshot].sort((a, b) => a.sequence - b.sequence) };
}

export function resolveCharacterSceneState(memory: CharacterStateMemory, query: CharacterStateMemoryQuery = {}): CharacterSceneState | undefined {
  if (query.sceneId) return memory.snapshots.find((snapshot) => snapshot.sceneId === query.sceneId);
  if (query.asOf) {
    const target = Date.parse(query.asOf);
    if (Number.isNaN(target)) throw new Error("Character state memory query timestamp is invalid.");
    return [...memory.snapshots].reverse().find((snapshot) => Date.parse(snapshot.capturedAt) <= target);
  }
  return memory.snapshots.at(-1);
}

export function rankCharacterStateSnapshots(memory: CharacterStateMemory, query: { text: string; limit?: number }): readonly CharacterSceneState[] {
  const terms = tokenize(query.text);
  if (!terms.length) return memory.snapshots.slice(-(query.limit ?? 5)).reverse();
  return [...memory.snapshots]
    .map((snapshot) => ({ snapshot, score: scoreSnapshot(snapshot, terms) }))
    .sort((a, b) => b.score - a.score || b.snapshot.sequence - a.snapshot.sequence)
    .slice(0, Math.max(1, query.limit ?? 5))
    .map((item) => item.snapshot);
}

export function validateCharacterStateMemory(value: unknown): CharacterStateMemory {
  if (!value || typeof value !== "object") throw new Error("Invalid character state memory.");
  const candidate = value as Record<string, unknown>;
  if (candidate.formatVersion !== CHARACTER_STATE_MEMORY_FORMAT_VERSION || typeof candidate.characterId !== "string" || typeof candidate.projectId !== "string" || !Array.isArray(candidate.snapshots)) throw new Error("Invalid character state memory format.");
  let previousSequence = 0;
  for (const snapshot of candidate.snapshots) {
    if (!snapshot || typeof snapshot !== "object") throw new Error("Invalid character state snapshot.");
    const item = snapshot as Record<string, unknown>;
    if (item.characterId !== candidate.characterId || item.projectId !== candidate.projectId || typeof item.sceneId !== "string" || !item.sceneId.trim() || !Number.isInteger(item.sequence) || Number(item.sequence) <= previousSequence || typeof item.capturedAt !== "string" || Number.isNaN(Date.parse(item.capturedAt)) || !item.profile || typeof item.profile !== "object" || !Array.isArray(item.changedFields) || (item.source !== "author" && item.source !== "approved-system")) throw new Error("Invalid character state snapshot.");
    previousSequence = Number(item.sequence);
  }
  return value as CharacterStateMemory;
}

function scoreSnapshot(snapshot: CharacterSceneState, terms: readonly string[]): number {
  const haystack = JSON.stringify({ profile: snapshot.profile, sceneId: snapshot.sceneId, changedFields: snapshot.changedFields }).toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? (snapshot.changedFields.some((field) => field.toLowerCase().includes(term)) ? 3 : 1) : 0), 0);
}
function tokenize(text: string): string[] { return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2))]; }
function cloneProfile(profile: CharacterProfile): CharacterProfile { return { ...profile, speechPatterns: [...profile.speechPatterns], values: [...profile.values], fears: [...profile.fears], secrets: [...profile.secrets], goals: [...profile.goals], motivations: [...profile.motivations], relationships: profile.relationships.map((item) => ({ ...item })), knowledge: [...profile.knowledge], skills: [...profile.skills], weaknesses: [...profile.weaknesses], importantObjects: [...profile.importantObjects], currentInjuries: [...profile.currentInjuries] }; }
