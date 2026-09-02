import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import { generateProjectText, type AiGenerationResult, type ProjectAiGenerationRequest } from "../infrastructure/ai-provider";
import type { ProjectState } from "../domain/project";
import { ProjectMemoryStore } from "./project-memory-store";

const DATAMUSE_BASE_URL = process.env.DATAMUSE_BASE_URL?.trim() || "https://api.datamuse.com";
const DICTIONARY_BASE_URL = process.env.DICTIONARY_BASE_URL?.trim() || "https://api.dictionaryapi.dev";
const LEXICAL_TIMEOUT_MS = positiveInteger(process.env.LEXICAL_TIMEOUT_MS) ?? 8_000;

interface DatamuseWord {
  readonly word?: unknown;
  readonly score?: unknown;
  readonly tags?: unknown;
  readonly defs?: unknown;
  readonly numSyllables?: unknown;
  readonly defHeadword?: unknown;
}
interface DictionaryDefinition { readonly definition?: unknown; readonly example?: unknown; readonly synonyms?: unknown; readonly antonyms?: unknown; }
interface DictionaryMeaning { readonly partOfSpeech?: unknown; readonly definitions?: unknown; readonly synonyms?: unknown; readonly antonyms?: unknown; }
interface DictionaryEntry { readonly word?: unknown; readonly phonetic?: unknown; readonly meanings?: unknown; }

export interface LexicalCandidate {
  readonly word: string;
  readonly source: "datamuse-synonym" | "datamuse-means-like" | "dictionary-synonym";
  readonly score?: number;
  readonly partsOfSpeech: readonly string[];
  readonly definitions: readonly string[];
  readonly syllables?: number;
  readonly frequencyPerMillion?: number;
  readonly previewSentence?: string;
}
export interface LexicalLookupResult {
  readonly query: string;
  readonly sentence?: string;
  readonly definitions: readonly { partOfSpeech: string; definition: string; example?: string }[];
  readonly phonetic?: string;
  readonly candidates: readonly LexicalCandidate[];
  readonly sources: readonly { name: string; url: string; available: boolean; error?: string }[];
  readonly partial: boolean;
}

type LexicalGenerator = (request: ProjectAiGenerationRequest) => Promise<AiGenerationResult>;
export type StudioLexicalRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

export function createStudioLexicalRoutes(
  store: Pick<FileProjectStore, "load">,
  generator: LexicalGenerator = generateProjectText,
): StudioLexicalRouteHandler {
  return async (req, res, url, projectId) => {
    if (url.pathname === `/api/projects/${projectId}/lexicon/lookup` && req.method === "POST") {
      await requireProject(store, projectId);
      const input = await body(req);
      const word = normalizeWord(input.word);
      const sentence = optionalText(input.sentence, 4_000);
      const leftContext = optionalText(input.leftContext, 120);
      const rightContext = optionalText(input.rightContext, 120);
      json(res, 200, await lookupWordChoice(word, { sentence, leftContext, rightContext }));
      return true;
    }

    if (url.pathname === `/api/projects/${projectId}/lexicon/compare` && req.method === "POST") {
      const project = await requireProject(store, projectId);
      const input = await body(req);
      const word = normalizeWord(input.word);
      const sentence = requiredText(input.sentence, "Sentence", 4_000);
      const leftContext = optionalText(input.leftContext, 120);
      const rightContext = optionalText(input.rightContext, 120);
      const lookup = await lookupWordChoice(word, { sentence, leftContext, rightContext });
      const selected = Array.isArray(input.candidates)
        ? input.candidates.map((value) => String(value).trim()).filter(Boolean).slice(0, 12)
        : lookup.candidates.slice(0, 8).map((candidate) => candidate.word);
      if (!selected.length) throw new Error("No lexical alternatives are available to compare.");
      const evidence = lookup.candidates.filter((candidate) => selected.includes(candidate.word));
      const memory = new ProjectMemoryStore();
      memory.restore(project.memories);
      const result = await generator({
        memory,
        context: {
          projectId,
          taskMemoryClasses: ["author-memory", "style-memory", "story-canon", "decision-memory"],
          relevanceTags: ["author-voice", "style"],
          queryTerms: [word, ...selected],
          includeWorkingState: true,
          limit: 24,
        },
        system: [
          "You are the Word Choice editor inside Author's Forge.",
          "Use the supplied dictionary/thesaurus evidence as evidence, not as permission to invent definitions.",
          "Compare nuance, register, emotional coloring, rhythm and fit in the exact sentence while preserving the author's intended meaning and voice.",
          "Do not silently choose for the author. Present choices and tradeoffs.",
        ].join(" "),
        user: [
          `TARGET WORD: ${word}`,
          `SOURCE SENTENCE: ${sentence}`,
          `LEXICAL EVIDENCE: ${JSON.stringify(evidence)}`,
          "For each candidate, explain the meaning shift in one or two sentences and show the full sentence with that candidate substituted where grammatically reasonable.",
          "Then identify: closest meaning; strongest emotional alternative; simplest alternative; most literary alternative; and any candidate that should NOT be used in this context. Keep the final decision with the author.",
        ].join("\n\n"),
        task: "editing",
        requiresReasoning: true,
        requiresInstructionFollowing: true,
        temperature: 0.1,
        maxOutputTokens: 3500,
      });
      json(res, 200, { lookup, comparison: result.text, provider: result.provider, model: result.model, authorChooses: true });
      return true;
    }

    return false;
  };
}

export async function lookupWordChoice(
  word: string,
  context: { sentence?: string; leftContext?: string; rightContext?: string } = {},
): Promise<LexicalLookupResult> {
  const sources: Array<{ name: string; url: string; available: boolean; error?: string }> = [];
  let dictionaryEntries: DictionaryEntry[] = [];
  let synonymWords: DatamuseWord[] = [];
  let meansLikeWords: DatamuseWord[] = [];

  const dictionaryUrl = `${DICTIONARY_BASE_URL.replace(/\/$/, "")}/api/v2/entries/en/${encodeURIComponent(word)}`;
  try {
    const response = await timedFetch(dictionaryUrl);
    if (response.ok) dictionaryEntries = await response.json() as DictionaryEntry[];
    else if (response.status !== 404) throw new Error(`HTTP ${response.status}`);
    sources.push({ name: "Free Dictionary API", url: "https://dictionaryapi.dev/", available: response.ok });
  } catch (error) {
    sources.push({ name: "Free Dictionary API", url: "https://dictionaryapi.dev/", available: false, error: errorMessage(error) });
  }

  const common = new URLSearchParams({ md: "dpsf", max: "24" });
  if (context.leftContext) common.set("lc", lastToken(context.leftContext));
  if (context.rightContext) common.set("rc", firstToken(context.rightContext));
  const synonymParams = new URLSearchParams(common); synonymParams.set("rel_syn", word);
  const meansLikeParams = new URLSearchParams(common); meansLikeParams.set("ml", word); meansLikeParams.set("max", "16");
  const datamuseUrl = `${DATAMUSE_BASE_URL.replace(/\/$/, "")}/words`;
  try {
    const [synonymsResponse, meansResponse] = await Promise.all([
      timedFetch(`${datamuseUrl}?${synonymParams.toString()}`),
      timedFetch(`${datamuseUrl}?${meansLikeParams.toString()}`),
    ]);
    if (!synonymsResponse.ok) throw new Error(`synonym query HTTP ${synonymsResponse.status}`);
    if (!meansResponse.ok) throw new Error(`means-like query HTTP ${meansResponse.status}`);
    synonymWords = await synonymsResponse.json() as DatamuseWord[];
    meansLikeWords = await meansResponse.json() as DatamuseWord[];
    sources.push({ name: "Datamuse API", url: "https://www.datamuse.com/api/", available: true });
  } catch (error) {
    sources.push({ name: "Datamuse API", url: "https://www.datamuse.com/api/", available: false, error: errorMessage(error) });
  }

  if (!sources.some((source) => source.available)) throw new Error("Dictionary and thesaurus services are unavailable. Forge will not fabricate lexical results.");

  const definitions = dictionaryDefinitions(dictionaryEntries);
  const dictionarySynonyms = collectDictionarySynonyms(dictionaryEntries);
  const candidates = new Map<string, LexicalCandidate>();
  const add = (candidate: LexicalCandidate) => {
    const key = candidate.word.toLowerCase();
    if (!key || key === word.toLowerCase()) return;
    const existing = candidates.get(key);
    if (!existing || (candidate.score ?? 0) > (existing.score ?? 0)) candidates.set(key, candidate);
  };
  for (const item of synonymWords) add(datamuseCandidate(item, "datamuse-synonym", context.sentence, word));
  for (const item of meansLikeWords) add(datamuseCandidate(item, "datamuse-means-like", context.sentence, word));
  for (const synonym of dictionarySynonyms) add({ word: synonym, source: "dictionary-synonym", partsOfSpeech: [], definitions: [], ...(context.sentence ? { previewSentence: replaceWord(context.sentence, word, synonym) } : {}) });

  const ordered = [...candidates.values()].sort((a, b) => {
    const sourceWeight = (source: LexicalCandidate["source"]) => source === "datamuse-synonym" ? 3 : source === "dictionary-synonym" ? 2 : 1;
    return sourceWeight(b.source) - sourceWeight(a.source) || (b.score ?? 0) - (a.score ?? 0) || a.word.localeCompare(b.word);
  }).slice(0, 32);

  return {
    query: word,
    ...(context.sentence ? { sentence: context.sentence } : {}),
    definitions,
    ...(dictionaryPhonetic(dictionaryEntries) ? { phonetic: dictionaryPhonetic(dictionaryEntries) } : {}),
    candidates: ordered,
    sources,
    partial: sources.some((source) => !source.available),
  };
}

function datamuseCandidate(item: DatamuseWord, source: "datamuse-synonym" | "datamuse-means-like", sentence: string | undefined, target: string): LexicalCandidate {
  const word = String(item.word ?? "").trim();
  const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
  const definitions = Array.isArray(item.defs) ? item.defs.map(String).map((value) => value.replace(/^[a-z]+\t/i, "").trim()).filter(Boolean) : [];
  const frequencyTag = tags.find((tag) => tag.startsWith("f:"));
  const frequency = frequencyTag ? Number(frequencyTag.slice(2)) : undefined;
  const syllables = Number(item.numSyllables);
  const score = Number(item.score);
  return {
    word,
    source,
    ...(Number.isFinite(score) ? { score } : {}),
    partsOfSpeech: tags.filter((tag) => ["n", "v", "adj", "adv", "u"].includes(tag)),
    definitions,
    ...(Number.isFinite(syllables) && syllables > 0 ? { syllables } : {}),
    ...(Number.isFinite(frequency) ? { frequencyPerMillion: frequency } : {}),
    ...(sentence ? { previewSentence: replaceWord(sentence, target, word) } : {}),
  };
}
function dictionaryDefinitions(entries: readonly DictionaryEntry[]): Array<{ partOfSpeech: string; definition: string; example?: string }> {
  const output: Array<{ partOfSpeech: string; definition: string; example?: string }> = [];
  for (const entry of entries) for (const meaning of Array.isArray(entry.meanings) ? entry.meanings as DictionaryMeaning[] : []) {
    const partOfSpeech = String(meaning.partOfSpeech ?? "unknown");
    for (const definition of Array.isArray(meaning.definitions) ? meaning.definitions as DictionaryDefinition[] : []) {
      const text = String(definition.definition ?? "").trim();
      if (!text) continue;
      const example = String(definition.example ?? "").trim();
      output.push({ partOfSpeech, definition: text, ...(example ? { example } : {}) });
    }
  }
  return output.slice(0, 16);
}
function collectDictionarySynonyms(entries: readonly DictionaryEntry[]): string[] {
  const values: string[] = [];
  for (const entry of entries) for (const meaning of Array.isArray(entry.meanings) ? entry.meanings as DictionaryMeaning[] : []) {
    if (Array.isArray(meaning.synonyms)) values.push(...meaning.synonyms.map(String));
    for (const definition of Array.isArray(meaning.definitions) ? meaning.definitions as DictionaryDefinition[] : []) if (Array.isArray(definition.synonyms)) values.push(...definition.synonyms.map(String));
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 24);
}
function dictionaryPhonetic(entries: readonly DictionaryEntry[]): string | undefined {
  return entries.map((entry) => String(entry.phonetic ?? "").trim()).find(Boolean);
}
function replaceWord(sentence: string, target: string, replacement: string): string {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp(`\\b${escaped}\\b`, "i");
  return expression.test(sentence) ? sentence.replace(expression, preserveInitialCase(sentence.match(expression)?.[0] ?? target, replacement)) : sentence;
}
function preserveInitialCase(original: string, replacement: string): string {
  return /^[A-Z]/.test(original) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
}
function normalizeWord(value: unknown): string {
  const word = String(value ?? "").normalize("NFKC").trim();
  if (!word) throw new Error("Word is required.");
  if (word.length > 80) throw new Error("Word exceeds 80 characters.");
  if (!/^[\p{L}\p{M}'’-]+$/u.test(word)) throw new Error("Word must contain letters and ordinary apostrophe/hyphen characters only.");
  return word;
}
function requiredText(value: unknown, label: string, max: number): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return text;
}
function optionalText(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  if (text.length > max) throw new Error(`Lexical context exceeds ${max} characters.`);
  return text;
}
function firstToken(value: string): string { return value.trim().split(/\s+/)[0] ?? ""; }
function lastToken(value: string): string { const tokens = value.trim().split(/\s+/); return tokens.at(-1) ?? ""; }
async function timedFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LEXICAL_TIMEOUT_MS);
  try { return await fetch(url, { signal: controller.signal, headers: { accept: "application/json", "user-agent": "Authors-Forge/1.0 lexical-word-choice" } }); }
  finally { clearTimeout(timer); }
}
async function requireProject(store: Pick<FileProjectStore, "load">, projectId: string): Promise<ProjectState> {
  const project = await store.load(projectId);
  if (!project) throw new Error(`Project "${projectId}" not found.`);
  return project;
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 512 * 1024) throw new Error("Lexical request body exceeds 512 KiB limit.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Lexical JSON object body required.");
  return value as Record<string, unknown>;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function positiveInteger(value: string | undefined): number | undefined { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined; }
