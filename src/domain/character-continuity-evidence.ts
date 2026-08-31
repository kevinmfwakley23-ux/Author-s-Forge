import { createHash } from "node:crypto";
import type { CharacterRecord } from "./character-bible";

export const CHARACTER_CONTINUITY_EVIDENCE_FORMAT_VERSION = 1 as const;

export interface CharacterContinuityAnchor {
  readonly characterId: string;
  readonly profileSha256: string;
  readonly evidence: readonly string[];
}

export interface CharacterContinuityEvidence {
  readonly formatVersion: typeof CHARACTER_CONTINUITY_EVIDENCE_FORMAT_VERSION;
  readonly projectId: string;
  readonly checkedAt: string;
  readonly status: "clear" | "not-applicable";
  readonly characters: readonly CharacterContinuityAnchor[];
}

export interface CharacterContinuityVerification {
  readonly valid: boolean;
  readonly findings: readonly string[];
}

export function createCharacterContinuityEvidence(input: {
  projectId: string;
  characters: readonly CharacterRecord[];
  selectedCharacterIds: readonly string[];
  evidence?: Readonly<Record<string, readonly string[]>>;
  checkedAt?: string;
}): CharacterContinuityEvidence {
  if (!input.projectId.trim()) throw new Error("Character continuity evidence requires a project id.");
  const selected = [...new Set(input.selectedCharacterIds.map((id) => id.trim()).filter(Boolean))].sort();
  const records = new Map(input.characters.map((character) => [character.id, character]));
  const characters = selected.map((characterId) => {
    const character = records.get(characterId);
    if (!character) throw new Error(`Character continuity evidence references missing character "${characterId}".`);
    if (character.projectId !== input.projectId) throw new Error(`Character continuity evidence character "${characterId}" belongs to another project.`);
    return {
      characterId,
      profileSha256: profileHash(character),
      evidence: [...new Set(input.evidence?.[characterId] ?? [])],
    };
  });
  const checkedAt = normalizeTimestamp(input.checkedAt ?? new Date().toISOString());
  return {
    formatVersion: CHARACTER_CONTINUITY_EVIDENCE_FORMAT_VERSION,
    projectId: input.projectId,
    checkedAt,
    status: characters.length ? "clear" : "not-applicable",
    characters,
  };
}

export function verifyCharacterContinuityEvidence(
  evidence: CharacterContinuityEvidence,
  characters: readonly CharacterRecord[],
): CharacterContinuityVerification {
  validateCharacterContinuityEvidence(evidence);
  const current = new Map(characters.map((character) => [character.id, character]));
  const findings: string[] = [];
  for (const anchor of evidence.characters) {
    const character = current.get(anchor.characterId);
    if (!character) {
      findings.push(`Character "${anchor.characterId}" no longer exists.`);
      continue;
    }
    if (character.projectId !== evidence.projectId) {
      findings.push(`Character "${anchor.characterId}" is no longer scoped to this project.`);
      continue;
    }
    if (profileHash(character) !== anchor.profileSha256) findings.push(`Character "${anchor.characterId}" changed after this proposal was generated.`);
  }
  return { valid: findings.length === 0, findings };
}

export function validateCharacterContinuityEvidence(value: unknown): CharacterContinuityEvidence {
  if (!value || typeof value !== "object") throw new Error("Invalid character continuity evidence.");
  const candidate = value as Record<string, unknown>;
  if (candidate.formatVersion !== CHARACTER_CONTINUITY_EVIDENCE_FORMAT_VERSION || typeof candidate.projectId !== "string" || !candidate.projectId.trim() || typeof candidate.checkedAt !== "string" || Number.isNaN(Date.parse(candidate.checkedAt)) || (candidate.status !== "clear" && candidate.status !== "not-applicable") || !Array.isArray(candidate.characters)) throw new Error("Invalid character continuity evidence format.");
  const ids = new Set<string>();
  for (const raw of candidate.characters) {
    if (!raw || typeof raw !== "object") throw new Error("Invalid character continuity anchor.");
    const anchor = raw as Record<string, unknown>;
    if (typeof anchor.characterId !== "string" || !anchor.characterId.trim() || typeof anchor.profileSha256 !== "string" || !/^[a-f0-9]{64}$/.test(anchor.profileSha256) || !Array.isArray(anchor.evidence) || anchor.evidence.some((item) => typeof item !== "string")) throw new Error("Invalid character continuity anchor.");
    if (ids.has(anchor.characterId)) throw new Error(`Duplicate character continuity anchor "${anchor.characterId}".`);
    ids.add(anchor.characterId);
  }
  if (candidate.status === "clear" && candidate.characters.length === 0) throw new Error("Clear character continuity evidence requires at least one character.");
  if (candidate.status === "not-applicable" && candidate.characters.length !== 0) throw new Error("Not-applicable character continuity evidence cannot contain character anchors.");
  return value as CharacterContinuityEvidence;
}

function profileHash(character: CharacterRecord): string {
  return createHash("sha256").update(JSON.stringify(character.profile), "utf8").digest("hex");
}

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Character continuity evidence timestamp is invalid.");
  return parsed.toISOString();
}
