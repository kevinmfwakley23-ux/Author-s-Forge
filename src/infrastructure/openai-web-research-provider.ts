import type { ResearchProvider, ResearchProviderRequest, ResearchProviderResult } from "../application/research-engine";
import type { ResearchConfidence, ResearchRelevance } from "../domain/research";

export interface OpenAiWebResearchOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly endpoint?: string;
  readonly searchContextSize?: "low" | "medium" | "high";
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  readonly maxClaims?: number;
}

/** Hosted, source-backed general research. Every persisted URL must be present
 * in the actual web_search source set returned by the Responses API. */
export class OpenAiWebResearchProvider implements ResearchProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly searchContextSize: "low" | "medium" | "high";
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly maxClaims: number;

  constructor(options: OpenAiWebResearchOptions = {}) {
    this.apiKey = options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
    this.model = options.model?.trim() || process.env.OPENAI_RESEARCH_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "";
    this.endpoint = options.endpoint?.trim() || process.env.OPENAI_RESPONSES_ENDPOINT?.trim() || "https://api.openai.com/v1/responses";
    this.searchContextSize = options.searchContextSize ?? "high";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.maxClaims = options.maxClaims ?? 8;
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is required for live web research.");
    if (!this.model) throw new Error("OPENAI_RESEARCH_MODEL or OPENAI_MODEL is required for live web research.");
    if (!Number.isInteger(this.maxClaims) || this.maxClaims < 1 || this.maxClaims > 20) throw new Error("Live research maxClaims must be an integer from 1 to 20.");
  }

  async research(request: ResearchProviderRequest): Promise<readonly ResearchProviderResult[]> {
    if (!request.question.trim()) throw new Error("Live research question is required.");
    if (!request.projectId.trim()) throw new Error("Live research project id is required.");
    const observedAt = this.now().toISOString();
    const observedDate = observedAt.slice(0, 10);
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        tools: [{ type: "web_search", search_context_size: this.searchContextSize }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        input: [
          { role: "system", content: systemPrompt(observedAt, observedDate, this.maxClaims) },
          { role: "user", content: `Research domain: ${request.domain}\nQuestion: ${request.question.trim()}\nReturn only source-backed findings that directly help answer the question.` },
        ],
        max_output_tokens: 6000,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(openAiError(payload, response.status));
    const sources = collectWebSearchSourceUrls(payload);
    if (!sources.size) throw new Error("Live web research returned no verifiable web-search sources.");
    const parsed = parseJson(extractOutputText(payload));
    const rows = objectArray(parsed.claims, "Live research claims");
    if (!rows.length) throw new Error("Live web research returned no source-backed claims.");
    if (rows.length > this.maxClaims) throw new Error(`Live web research returned more than ${this.maxClaims} claims.`);
    return rows.map((row, index) => normalizeClaim(row, index, sources, observedDate));
  }
}

type ParsedResearch = { readonly claims?: unknown };

function systemPrompt(observedAt: string, observedDate: string, maxClaims: number): string {
  return `You are the live research engine for Author's Forge. You MUST use hosted web search before answering. Prefer primary, authoritative, and recent sources when the question is time-sensitive; use multiple independent sources when useful. Never invent a source, URL, date, quote, statistic, or factual detail. Distinguish direct source facts from bounded synthesis. If a source publication/update date is not visible, use the research observation date ${observedDate}; that field then means observed/retrieved date, not an invented publication date. Return no more than ${maxClaims} high-value claims.\n\nReturn ONLY JSON: {"claims":[{"source":"publisher or site name","date":"YYYY-MM-DD","url":"https://...","claim":"specific source-backed finding in your own words","confidence":"low|medium|high","relevance":"low|medium|high"}]}. Every URL must be a page actually consulted by web_search. The observation timestamp is ${observedAt}.`;
}

function normalizeClaim(row: Record<string, unknown>, index: number, sources: ReadonlySet<string>, observedDate: string): ResearchProviderResult {
  const url = canonicalUrl(text(row.url, `Research claim ${index + 1} URL`));
  if (!sources.has(url)) throw new Error(`Research claim ${index + 1} cites a URL that was not returned by hosted web search.`);
  const date = dateValue(row.date, observedDate, `Research claim ${index + 1} date`);
  return {
    source: text(row.source, `Research claim ${index + 1} source`),
    date,
    url,
    claim: text(row.claim, `Research claim ${index + 1} text`),
    confidence: enumValue(row.confidence, ["low", "medium", "high"] as const, `Research claim ${index + 1} confidence`) as ResearchConfidence,
    relevance: enumValue(row.relevance, ["low", "medium", "high"] as const, `Research claim ${index + 1} relevance`) as ResearchRelevance,
  };
}

function collectWebSearchSourceUrls(payload: Record<string, unknown>): Set<string> {
  const urls = new Set<string>();
  const visit = (value: unknown, inSearch = false): void => {
    if (Array.isArray(value)) { value.forEach((item) => visit(item, inSearch)); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const search = inSearch || record.type === "web_search_call";
    if (search && typeof record.url === "string") { try { urls.add(canonicalUrl(record.url)); } catch {} }
    for (const [key, child] of Object.entries(record)) visit(child, search || key === "sources");
  };
  visit(payload.output);
  return urls;
}

function extractOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const chunks: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if ((record.type === "output_text" || record.type === "text") && typeof record.text === "string") chunks.push(record.text);
    else if (record.type === "message" && typeof record.content === "string") chunks.push(record.content);
    Object.values(record).forEach(visit);
  };
  visit(payload.output);
  const textValue = chunks.join("\n").trim();
  if (!textValue) throw new Error("Live web research returned no textual result.");
  return textValue;
}

function parseJson(raw: string): ParsedResearch {
  const trimmed = raw.trim();
  const source = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed;
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("Live web research did not return valid JSON."); }
  return objectValue(parsed, "Live research JSON") as ParsedResearch;
}
function objectArray(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((item, index) => objectValue(item, `${label} ${index + 1}`));
}
function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${label} is invalid.`);
  return value as T;
}
function dateValue(value: unknown, observedDate: string, label: string): string {
  const date = value === undefined || value === null || value === "" ? observedDate : text(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error(`${label} must be YYYY-MM-DD.`);
  return date;
}
function canonicalUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Research source URL must be HTTP(S).");
  url.hash = "";
  return url.toString();
}
function openAiError(payload: Record<string, unknown>, status: number): string {
  const error = payload.error;
  if (error && typeof error === "object" && !Array.isArray(error) && typeof (error as Record<string, unknown>).message === "string") return `Live web research failed (${status}): ${(error as Record<string, unknown>).message}`;
  return `Live web research failed (${status}).`;
}
