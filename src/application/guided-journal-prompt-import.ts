import { JOURNAL_CATEGORIES, type JournalCategory, type JournalPrompt } from "../domain/guided-journal";
import { GuidedJournalLibraryService } from "./guided-journal-library";

export const JOURNAL_PROMPT_IMPORT_FORMATS = ["text", "csv", "json"] as const;
export type JournalPromptImportFormat = typeof JOURNAL_PROMPT_IMPORT_FORMATS[number];

export interface JournalPromptImportRequest {
  readonly projectId: string;
  readonly format: JournalPromptImportFormat;
  readonly content: string;
  readonly defaultCategory?: JournalCategory;
  readonly idPrefix?: string;
  readonly now?: string;
}

export interface JournalPromptImportResult {
  readonly imported: readonly JournalPrompt[];
  readonly duplicateTextsSkipped: readonly string[];
  readonly totalLibraryPrompts: number;
}

/**
 * Bulk import boundary for user-owned master question libraries.
 * AI is not involved. Imported questions remain directly author-controlled.
 */
export class GuidedJournalPromptImportService {
  constructor(private readonly library: GuidedJournalLibraryService) {}

  async import(request: JournalPromptImportRequest): Promise<JournalPromptImportResult> {
    const projectId = required(request.projectId, "Project id");
    if (!JOURNAL_PROMPT_IMPORT_FORMATS.includes(request.format)) throw new Error("Unsupported journal prompt import format.");
    if (typeof request.content !== "string" || !request.content.trim()) throw new Error("Prompt import content is required.");
    const defaultCategory = request.defaultCategory ?? "discover";
    if (!JOURNAL_CATEGORIES.includes(defaultCategory)) throw new Error("Invalid default prompt category.");

    const current = await this.library.get(projectId);
    const candidates = parseCandidates(request.format, request.content, defaultCategory, request.idPrefix ?? "import");
    const seenText = new Set(current.prompts.map((prompt) => normalizeText(prompt.text)));
    const seenIds = new Set(current.prompts.map((prompt) => prompt.id));
    const imported: JournalPrompt[] = [];
    const skipped: string[] = [];

    for (const candidate of candidates) {
      const normalized = normalizeText(candidate.text);
      if (seenText.has(normalized)) {
        skipped.push(candidate.text);
        continue;
      }
      seenText.add(normalized);
      let id = candidate.id;
      let suffix = 2;
      while (seenIds.has(id)) id = `${candidate.id}-${suffix++}`;
      seenIds.add(id);
      imported.push(Object.freeze({ ...candidate, id, tags: Object.freeze([...candidate.tags]) }));
    }

    if (imported.length) await this.library.upsertPrompts(projectId, imported, request.now);
    const finalLibrary = await this.library.get(projectId);
    return Object.freeze({
      imported: Object.freeze(imported),
      duplicateTextsSkipped: Object.freeze(skipped),
      totalLibraryPrompts: finalLibrary.prompts.length,
    });
  }
}

interface CandidatePrompt {
  readonly id: string;
  readonly category: JournalCategory;
  readonly text: string;
  readonly tags: readonly string[];
  readonly enabled: boolean;
}

function parseCandidates(format: JournalPromptImportFormat, content: string, defaultCategory: JournalCategory, idPrefix: string): CandidatePrompt[] {
  if (format === "text") return parseText(content, defaultCategory, idPrefix);
  if (format === "csv") return parseCsv(content, defaultCategory, idPrefix);
  return parseJson(content, defaultCategory, idPrefix);
}

function parseText(content: string, defaultCategory: JournalCategory, idPrefix: string): CandidatePrompt[] {
  const rows = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return rows.map((text, index) => candidate({ text, category: defaultCategory }, idPrefix, index));
}

function parseJson(content: string, defaultCategory: JournalCategory, idPrefix: string): CandidatePrompt[] {
  let parsed: unknown;
  try { parsed = JSON.parse(content); }
  catch { throw new Error("Prompt JSON import is not valid JSON."); }
  const values = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { prompts?: unknown }).prompts)
      ? (parsed as { prompts: unknown[] }).prompts
      : undefined;
  if (!values) throw new Error("Prompt JSON import must be an array or an object containing a prompts array.");
  return values.map((value, index) => {
    if (typeof value === "string") return candidate({ text: value, category: defaultCategory }, idPrefix, index);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Prompt JSON row ${index + 1} is invalid.`);
    const row = value as Record<string, unknown>;
    return candidate({
      id: typeof row.id === "string" ? row.id : undefined,
      text: stringValue(row.text, `Prompt JSON row ${index + 1} text`),
      category: categoryValue(row.category, defaultCategory, `Prompt JSON row ${index + 1}`),
      tags: tagsValue(row.tags),
      enabled: booleanValue(row.enabled, true),
    }, idPrefix, index);
  });
}

function parseCsv(content: string, defaultCategory: JournalCategory, idPrefix: string): CandidatePrompt[] {
  const rows = parseCsvRows(content).filter((row) => row.some((value) => value.trim()));
  if (!rows.length) return [];
  const headers = rows[0].map((value) => value.trim().toLocaleLowerCase());
  const hasHeader = headers.includes("text") || headers.includes("question") || headers.includes("prompt");
  const body = hasHeader ? rows.slice(1) : rows;
  const indexOf = (names: readonly string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const textIndex = hasHeader ? indexOf(["text", "question", "prompt"]) : 0;
  const idIndex = hasHeader ? indexOf(["id"]) : -1;
  const categoryIndex = hasHeader ? indexOf(["category"]) : -1;
  const tagsIndex = hasHeader ? indexOf(["tags"]) : -1;
  const enabledIndex = hasHeader ? indexOf(["enabled"]) : -1;
  if (textIndex < 0) throw new Error("Prompt CSV import requires a text, question, or prompt column.");

  return body.map((row, index) => candidate({
    id: idIndex >= 0 ? row[idIndex] : undefined,
    text: required(row[textIndex] ?? "", `Prompt CSV row ${index + 1} text`),
    category: categoryValue(categoryIndex >= 0 ? row[categoryIndex] : undefined, defaultCategory, `Prompt CSV row ${index + 1}`),
    tags: tagsIndex >= 0 ? splitTags(row[tagsIndex] ?? "") : [],
    enabled: enabledIndex >= 0 ? parseCsvBoolean(row[enabledIndex], true) : true,
  }, idPrefix, index));
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (quoted) throw new Error("Prompt CSV import contains an unterminated quoted field.");
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function candidate(input: { id?: string; category: JournalCategory; text: string; tags?: readonly string[]; enabled?: boolean }, idPrefix: string, index: number): CandidatePrompt {
  const text = required(input.text, "Imported prompt text");
  const category = input.category;
  if (!JOURNAL_CATEGORIES.includes(category)) throw new Error(`Imported prompt has invalid category "${category}".`);
  const baseId = input.id?.trim() || `${slug(idPrefix)}-${stableId(`${category}:${normalizeText(text)}`)}-${index + 1}`;
  return Object.freeze({ id: required(baseId, "Imported prompt id"), category, text, tags: Object.freeze(unique(input.tags ?? [])), enabled: input.enabled !== false });
}

function categoryValue(value: unknown, fallback: JournalCategory, label: string): JournalCategory {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLocaleLowerCase() as JournalCategory;
  if (!JOURNAL_CATEGORIES.includes(normalized)) throw new Error(`${label} has invalid category "${String(value)}".`);
  return normalized;
}

function tagsValue(value: unknown): string[] {
  if (Array.isArray(value)) return unique(value.filter((item): item is string => typeof item === "string"));
  if (typeof value === "string") return splitTags(value);
  return [];
}

function splitTags(value: string): string[] { return unique(value.split(/[;|]/)); }
function booleanValue(value: unknown, fallback: boolean): boolean { return typeof value === "boolean" ? value : fallback; }
function parseCsvBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || !value.trim()) return fallback;
  const normalized = value.trim().toLocaleLowerCase();
  if (["true", "1", "yes", "y", "enabled"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "disabled"].includes(normalized)) return false;
  throw new Error(`Invalid CSV enabled value "${value}".`);
}
function stringValue(value: unknown, label: string): string { if (typeof value !== "string") throw new Error(`${label} is required.`); return required(value, label); }
function unique(values: readonly string[]): string[] { return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))]; }
function normalizeText(value: string): string { return value.trim().toLocaleLowerCase().replace(/\s+/g, " "); }
function slug(value: string): string { return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "import"; }
function stableId(value: string): string { let hash = 2166136261 >>> 0; for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
function required(value: string, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
