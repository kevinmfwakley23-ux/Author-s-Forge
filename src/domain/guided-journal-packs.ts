import { validatePromptLibrary, type JournalPrompt } from "./guided-journal";

export const GUIDED_JOURNAL_PROMPT_PACK_FORMAT_VERSION = 1 as const;
export const PROMPT_PACK_MODES = ["ordered", "deterministic-shuffle"] as const;
export const PROMPT_PACK_SOURCES = ["user", "curated", "imported"] as const;

export type PromptPackMode = typeof PROMPT_PACK_MODES[number];
export type PromptPackSource = typeof PROMPT_PACK_SOURCES[number];

export interface GuidedJournalPromptPack {
  readonly formatVersion: typeof GUIDED_JOURNAL_PROMPT_PACK_FORMAT_VERSION;
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly description?: string;
  readonly mode: PromptPackMode;
  readonly source: PromptPackSource;
  readonly tags: readonly string[];
  readonly prompts: readonly JournalPrompt[];
  readonly sourceLibraryFingerprint: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateGuidedJournalPromptPackRequest {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly mode?: PromptPackMode;
  readonly source?: PromptPackSource;
  readonly tags?: readonly string[];
  readonly promptIds: readonly string[];
  readonly promptLibrary: readonly JournalPrompt[];
  readonly now?: string;
}

export interface ReviseGuidedJournalPromptPackRequest {
  readonly previous: GuidedJournalPromptPack;
  readonly title?: string;
  readonly description?: string;
  readonly mode?: PromptPackMode;
  readonly source?: PromptPackSource;
  readonly tags?: readonly string[];
  readonly promptIds?: readonly string[];
  readonly promptLibrary: readonly JournalPrompt[];
  readonly now?: string;
}

export function createGuidedJournalPromptPack(request: CreateGuidedJournalPromptPackRequest): GuidedJournalPromptPack {
  const now = timestamp(request.now);
  return buildPack({
    id: required(request.id, "Prompt pack id"),
    version: 1,
    title: required(request.title, "Prompt pack title"),
    description: optional(request.description),
    mode: request.mode ?? "ordered",
    source: request.source ?? "user",
    tags: request.tags ?? [],
    promptIds: request.promptIds,
    promptLibrary: request.promptLibrary,
    createdAt: now,
    updatedAt: now,
  });
}

export function reviseGuidedJournalPromptPack(request: ReviseGuidedJournalPromptPackRequest): GuidedJournalPromptPack {
  validateGuidedJournalPromptPack(request.previous);
  const now = timestamp(request.now);
  const promptIds = request.promptIds ?? request.previous.prompts.map((prompt) => prompt.id);
  return buildPack({
    id: request.previous.id,
    version: request.previous.version + 1,
    title: request.title === undefined ? request.previous.title : required(request.title, "Prompt pack title"),
    description: request.description === undefined ? request.previous.description : optional(request.description),
    mode: request.mode ?? request.previous.mode,
    source: request.source ?? request.previous.source,
    tags: request.tags ?? request.previous.tags,
    promptIds,
    promptLibrary: request.promptLibrary,
    createdAt: request.previous.createdAt,
    updatedAt: now,
  });
}

export function resolvePromptPackOrder(pack: GuidedJournalPromptPack, seed = "default"): readonly string[] {
  validateGuidedJournalPromptPack(pack);
  const ids = pack.prompts.map((prompt) => prompt.id);
  if (pack.mode === "ordered") return Object.freeze(ids);
  return Object.freeze(deterministicShuffle(ids, `${pack.id}:v${pack.version}:${required(seed, "Prompt pack seed")}`));
}

export function promptPackFingerprint(prompts: readonly JournalPrompt[]): string {
  const canonical = prompts
    .map((prompt) => `${prompt.id}\u001f${prompt.category}\u001f${prompt.enabled ? 1 : 0}\u001f${prompt.text}\u001f${[...prompt.tags].sort().join("\u001e")}`)
    .join("\u001d");
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function validateGuidedJournalPromptPack(pack: GuidedJournalPromptPack): void {
  if (pack.formatVersion !== GUIDED_JOURNAL_PROMPT_PACK_FORMAT_VERSION) throw new Error("Unsupported Guided Journal prompt pack version.");
  required(pack.id, "Prompt pack id");
  required(pack.title, "Prompt pack title");
  positiveInteger(pack.version, "Prompt pack version");
  if (!PROMPT_PACK_MODES.includes(pack.mode)) throw new Error("Unsupported prompt pack mode.");
  if (!PROMPT_PACK_SOURCES.includes(pack.source)) throw new Error("Unsupported prompt pack source.");
  timestamp(pack.createdAt);
  timestamp(pack.updatedAt);
  const prompts = validatePromptLibrary(pack.prompts);
  if (prompts.length !== pack.prompts.length) throw new Error("Prompt pack prompt snapshot is invalid.");
  if (promptPackFingerprint(prompts) !== pack.sourceLibraryFingerprint) throw new Error("Prompt pack fingerprint does not match its immutable prompt snapshot.");
}

function buildPack(input: {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly description?: string;
  readonly mode: PromptPackMode;
  readonly source: PromptPackSource;
  readonly tags: readonly string[];
  readonly promptIds: readonly string[];
  readonly promptLibrary: readonly JournalPrompt[];
  readonly createdAt: string;
  readonly updatedAt: string;
}): GuidedJournalPromptPack {
  if (!PROMPT_PACK_MODES.includes(input.mode)) throw new Error("Unsupported prompt pack mode.");
  if (!PROMPT_PACK_SOURCES.includes(input.source)) throw new Error("Unsupported prompt pack source.");
  positiveInteger(input.version, "Prompt pack version");

  const library = validatePromptLibrary(input.promptLibrary);
  const byId = new Map(library.map((prompt) => [prompt.id, prompt]));
  const requestedIds = uniqueNonEmpty(input.promptIds, "Prompt pack prompt ids");
  if (!requestedIds.length) throw new Error("Prompt pack must contain at least one prompt.");

  const prompts = requestedIds.map((id) => {
    const prompt = byId.get(id);
    if (!prompt) throw new Error(`Prompt pack references missing prompt "${id}".`);
    return Object.freeze({ ...prompt, tags: Object.freeze([...prompt.tags]) });
  });
  const fingerprint = promptPackFingerprint(prompts);

  const pack: GuidedJournalPromptPack = Object.freeze({
    formatVersion: GUIDED_JOURNAL_PROMPT_PACK_FORMAT_VERSION,
    id: input.id,
    version: input.version,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    mode: input.mode,
    source: input.source,
    tags: Object.freeze(uniqueStrings(input.tags)),
    prompts: Object.freeze(prompts),
    sourceLibraryFingerprint: fingerprint,
    createdAt: timestamp(input.createdAt),
    updatedAt: timestamp(input.updatedAt),
  });
  validateGuidedJournalPromptPack(pack);
  return pack;
}

function deterministicShuffle<T>(values: readonly T[], seed: string): T[] {
  const out = [...values];
  const random = seededRandom(seed);
  for (let index = out.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [out[index], out[selected]] = [out[selected], out[index]];
  }
  return out;
}

function seededRandom(seed: string): () => number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function uniqueNonEmpty(values: readonly string[], label: string): string[] {
  if (!Array.isArray(values)) throw new Error(`${label} must be an array.`);
  const normalized = values.map((value) => required(value, label));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} cannot contain duplicates.`);
  return normalized;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optional(value: string | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function positiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
}

function timestamp(value = new Date().toISOString()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Timestamp must be valid ISO date/time.");
  return date.toISOString();
}
