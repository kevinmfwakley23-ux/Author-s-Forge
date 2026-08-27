import type { CharacterRecord } from "./character-bible";
import { validateCharacterRecord } from "./character-bible";
import type { MemoryRecord } from "./memory";

export const PROJECT_FORMAT_VERSION = 2 as const;

export type ProjectStatus = "active" | "archived";

export interface ProjectMetadata {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: ProjectStatus;
}

export interface ProjectState {
  readonly formatVersion: typeof PROJECT_FORMAT_VERSION;
  readonly metadata: ProjectMetadata;
  readonly memories: readonly MemoryRecord[];
  readonly characters?: readonly CharacterRecord[];
}

export function createProject(input: { id: string; title: string; now?: string }): ProjectState {
  if (!input.id.trim()) throw new Error("Project id is required.");
  if (!input.title.trim()) throw new Error("Project title is required.");

  const now = input.now ?? new Date().toISOString();
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    metadata: {
      id: input.id,
      title: input.title.trim(),
      createdAt: now,
      updatedAt: now,
      status: "active"
    },
    memories: []
  };
}

export function touchProject(project: ProjectState, now = new Date().toISOString()): ProjectState {
  return { ...project, metadata: { ...project.metadata, updatedAt: now } };
}

export function withProjectMemories(project: ProjectState, memories: readonly MemoryRecord[], now = new Date().toISOString()): ProjectState {
  if (memories.some((memory) => memory.projectId !== project.metadata.id)) {
    throw new Error("Project memory state contains a memory from another project.");
  }
  const ids = new Set<string>();
  for (const memory of memories) {
    if (ids.has(memory.id)) throw new Error(`Duplicate memory id "${memory.id}" in project state.`);
    ids.add(memory.id);
  }
  return { ...project, metadata: { ...project.metadata, updatedAt: now }, memories: memories.map(cloneMemory) };
}

export function withProjectCharacters(project: ProjectState, characters: readonly CharacterRecord[], now = new Date().toISOString()): ProjectState {
  if (characters.some((character) => character.projectId !== project.metadata.id)) {
    throw new Error("Project character state contains a character from another project.");
  }
  const ids = new Set<string>();
  const validated = characters.map((character) => validateCharacterRecord(character));
  for (const character of validated) {
    if (ids.has(character.id)) throw new Error(`Duplicate character id "${character.id}" in project state.`);
    ids.add(character.id);
  }
  return { ...project, metadata: { ...project.metadata, updatedAt: now }, characters: validated.map(cloneCharacter) };
}

function cloneMemory(memory: MemoryRecord): MemoryRecord {
  return { ...memory, provenance: memory.provenance.map((item) => ({ ...item })), relatedMemoryIds: [...memory.relatedMemoryIds], relevanceTags: [...memory.relevanceTags] };
}

function cloneCharacter(character: CharacterRecord): CharacterRecord {
  return validateCharacterRecord(JSON.parse(JSON.stringify(character)));
}
