import type { KdpMarketIntelligenceProvider, KdpMarketIntelligenceProviderRequest, KdpMarketIntelligenceProviderResult } from "../application/kdp-market-intelligence";
import type { ComparableTitle, MarketEvidence, MarketKeywordRecommendation, MarketNicheOpportunity, MarketOpportunityAssessment, MarketSignal } from "../domain/kdp-market-intelligence";

const DISCLAIMER = "This report describes observable market signals and research evidence. It is not a guarantee, forecast, or promise of sales, rankings, revenue, or commercial performance.";

export interface OpenAiWebMarketResearchOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly endpoint?: string;
  readonly searchContextSize?: "low" | "medium" | "high";
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}

/**
 * Real current-market provider. It uses the OpenAI Responses API web-search tool,
 * then rejects any evidence URL the model did not actually receive from that tool.
 */
export class OpenAiWebKdpMarketIntelligenceProvider implements KdpMarketIntelligenceProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly searchContextSize: "low" | "medium" | "high";
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(options: OpenAiWebMarketResearchOptions = {}) {
    this.apiKey = options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
    this.model = options.model?.trim() || process.env.OPENAI_MARKET_RESEARCH_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "";
    this.endpoint = options.endpoint?.trim() || "https://api.openai.com/v1/responses";
    this.searchContextSize = options.searchContextSize ?? "high";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is required for live KDP market research.");
    if (!this.model) throw new Error("OPENAI_MARKET_RESEARCH_MODEL or OPENAI_MODEL is required for live KDP market research.");
  }

  async research(request: KdpMarketIntelligenceProviderRequest): Promise<KdpMarketIntelligenceProviderResult> {
    validateRequest(request);
    const observedAt = this.now().toISOString();
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        tools: [{ type: "web_search_preview", search_context_size: this.searchContextSize }],
        tool_choice: "auto",
        include: ["web_search_call.action.sources"],
        input: [
          { role: "system", content: marketResearchSystemPrompt(observedAt) },
          { role: "user", content: `Market: ${request.market.trim()}\nResearch question: ${request.question.trim()}\nReturn current evidence, ranked niche opportunities, and reader-search keyword candidates.` },
        ],
        max_output_tokens: 9000,
      }),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(openAiError(payload, response.status));

    const toolSourceUrls = collectWebSearchSourceUrls(payload);
    if (!toolSourceUrls.size) throw new Error("OpenAI market research returned no verifiable web-search sources.");
    const parsed = parseProviderJson(extractOutputText(payload));
    const evidence = normalizeEvidence(parsed.evidence, observedAt, toolSourceUrls);
    if (!evidence.length) throw new Error("OpenAI market research returned no source-backed market evidence.");
    const evidenceIds = new Set(evidence.map((item) => item.id));
    const signals = normalizeSignals(parsed.signals, evidenceIds);
    const keywordRecommendations = normalizeKeywords(parsed.keywordRecommendations, evidenceIds);
    const nicheOpportunities = normalizeNiches(parsed.nicheOpportunities, evidenceIds);
    const comparableTitles = normalizeComparables(parsed.comparableTitles, observedAt, toolSourceUrls);
    const assessment = normalizeAssessment(parsed.assessment);
    return { evidence, signals, comparableTitles, keywordRecommendations, nicheOpportunities, assessment };
  }
}

function marketResearchSystemPrompt(observedAt: string): string {
  return `You are the current-market research engine for Author's Forge. You MUST use web search before answering. Research observable book-market signals, not guaranteed future sales. Prefer fresh primary/retailer evidence and authoritative publishing guidance; use multiple independent sources where practical. Resolve contradictions explicitly.\n\nAmazon KDP keyword rules to enforce in recommendations: recommend reader-search language that accurately describes the actual proposed book/niche; KDP permits up to seven keyword slots; avoid other authors or their titles, sales-rank claims, promotions such as free/on sale, unrelated terms, Amazon program names, HTML, trademarks/brands the author is not authorized to use, and metadata manipulation. Do not simply repeat title/category wording when a more useful relevant phrase exists.\n\nReturn ONLY one JSON object with this exact top-level shape:\n{\n  \"evidence\": [{\"id\":\"e1\",\"source\":\"source/site name\",\"url\":\"https://...\",\"publishedAt\":\"optional ISO timestamp\",\"observation\":\"specific observed fact\",\"strength\":\"weak|moderate|strong\"}],\n  \"signals\": [{\"id\":\"s1\",\"topic\":\"genre|subgenre|niche|categories|competing-titles|publication-frequency|reader-expectations|pricing|cover-conventions|title-conventions|keyword-opportunities|emerging-niches|underserved-niches|comparable-books\",\"label\":\"short label\",\"observation\":\"what the evidence suggests\",\"direction\":\"positive|negative|mixed|neutral\",\"evidenceIds\":[\"e1\"]}],\n  \"comparableTitles\": [{\"title\":\"title\",\"author\":\"optional\",\"genre\":\"optional\",\"price\":0,\"currency\":\"USD\",\"publishedDate\":\"optional\",\"sourceUrl\":\"https://...\"}],\n  \"keywordRecommendations\": [{\"phrase\":\"reader search phrase\",\"score\":0,\"rationale\":\"why relevant and useful\",\"evidenceIds\":[\"e1\"],\"recommendedForKdpSlot\":true,\"complianceNotes\":[\"accurate to proposed niche\"]}],\n  \"nicheOpportunities\": [{\"niche\":\"specific niche\",\"score\":0,\"demandSignal\":\"low|moderate|high|unknown\",\"competitionSignal\":\"low|moderate|high|unknown\",\"rationale\":\"evidence-based explanation\",\"evidenceIds\":[\"e1\"]}],\n  \"assessment\": {\"level\":\"low|moderate|promising|high\",\"rationale\":\"bounded conclusion\",\"signals\":[\"summary signal\"],\"limitations\":[\"what is unknown or volatile\"]}\n}\n\nScores are 0-100 research-priority scores, not predicted sales. Produce no more than 20 keyword candidates and no more than 20 niches; mark at most seven keywords recommendedForKdpSlot=true. Every signal, keyword, and niche must reference real evidence IDs. Every evidence URL and comparable sourceUrl must be an actual page consulted by web search. Observation timestamp: ${observedAt}.`;
}

type ParsedProvider = {
  evidence?: unknown; signals?: unknown; comparableTitles?: unknown;
  keywordRecommendations?: unknown; nicheOpportunities?: unknown; assessment?: unknown;
};

function parseProviderJson(text: string): ParsedProvider {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const source = fenced ? fenced[1] : trimmed;
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error("OpenAI market research did not return valid JSON."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("OpenAI market research JSON must be an object.");
  return value as ParsedProvider;
}

function normalizeEvidence(value: unknown, observedAt: string, allowedUrls: ReadonlySet<string>): MarketEvidence[] {
  return arrayOfObjects(value, "Market evidence").map((item, index) => {
    const id = text(item.id, `Market evidence ${index + 1} id`);
    const url = canonicalUrl(text(item.url, `Market evidence ${id} URL`));
    assertToolSource(url, allowedUrls, `Market evidence ${id}`);
    const publishedAt = optionalTimestamp(item.publishedAt, `Market evidence ${id} publishedAt`);
    return { id, source: text(item.source, `Market evidence ${id} source`), url, observedAt, ...(publishedAt ? { publishedAt } : {}), observation: text(item.observation, `Market evidence ${id} observation`), strength: enumValue(item.strength, ["weak", "moderate", "strong"] as const, `Market evidence ${id} strength`) };
  });
}

function normalizeSignals(value: unknown, evidenceIds: ReadonlySet<string>): MarketSignal[] {
  return arrayOfObjects(value, "Market signals").map((item, index) => {
    const id = text(item.id, `Market signal ${index + 1} id`);
    const refs = stringArray(item.evidenceIds, `Market signal ${id} evidence`); assertEvidenceRefs(refs, evidenceIds, `Market signal ${id}`);
    return { id, topic: enumValue(item.topic, ["genre", "subgenre", "niche", "categories", "competing-titles", "publication-frequency", "reader-expectations", "pricing", "cover-conventions", "title-conventions", "keyword-opportunities", "emerging-niches", "underserved-niches", "comparable-books"] as const, `Market signal ${id} topic`), label: text(item.label, `Market signal ${id} label`), observation: text(item.observation, `Market signal ${id} observation`), direction: enumValue(item.direction, ["positive", "negative", "mixed", "neutral"] as const, `Market signal ${id} direction`), evidenceIds: refs };
  });
}

function normalizeKeywords(value: unknown, evidenceIds: ReadonlySet<string>): MarketKeywordRecommendation[] {
  const items = arrayOfObjects(value ?? [], "Keyword recommendations");
  if (items.length > 20) throw new Error("OpenAI market research returned more than 20 keyword candidates.");
  const result = items.map((item, index) => {
    const phrase = text(item.phrase, `Keyword ${index + 1} phrase`);
    const refs = stringArray(item.evidenceIds, `Keyword ${phrase} evidence`); assertEvidenceRefs(refs, evidenceIds, `Keyword ${phrase}`);
    return { phrase, score: score(item.score, `Keyword ${phrase} score`), rationale: text(item.rationale, `Keyword ${phrase} rationale`), evidenceIds: refs, recommendedForKdpSlot: item.recommendedForKdpSlot === true, complianceNotes: stringArray(item.complianceNotes ?? [], `Keyword ${phrase} compliance notes`) };
  });
  if (result.filter((item) => item.recommendedForKdpSlot).length > 7) throw new Error("OpenAI market research recommended more than seven KDP keyword slots.");
  return result.sort((a, b) => b.score - a.score || a.phrase.localeCompare(b.phrase));
}

function normalizeNiches(value: unknown, evidenceIds: ReadonlySet<string>): MarketNicheOpportunity[] {
  const items = arrayOfObjects(value ?? [], "Niche opportunities");
  if (items.length > 20) throw new Error("OpenAI market research returned more than 20 niche opportunities.");
  return items.map((item, index) => {
    const niche = text(item.niche, `Niche ${index + 1}`);
    const refs = stringArray(item.evidenceIds, `Niche ${niche} evidence`); assertEvidenceRefs(refs, evidenceIds, `Niche ${niche}`);
    return { niche, score: score(item.score, `Niche ${niche} score`), demandSignal: enumValue(item.demandSignal, ["low", "moderate", "high", "unknown"] as const, `Niche ${niche} demand`), competitionSignal: enumValue(item.competitionSignal, ["low", "moderate", "high", "unknown"] as const, `Niche ${niche} competition`), rationale: text(item.rationale, `Niche ${niche} rationale`), evidenceIds: refs };
  }).sort((a, b) => b.score - a.score || a.niche.localeCompare(b.niche));
}

function normalizeComparables(value: unknown, observedAt: string, allowedUrls: ReadonlySet<string>): ComparableTitle[] {
  return arrayOfObjects(value ?? [], "Comparable titles").map((item, index) => {
    const title = text(item.title, `Comparable title ${index + 1}`);
    const sourceUrl = item.sourceUrl === undefined ? undefined : canonicalUrl(text(item.sourceUrl, `Comparable title ${title} source URL`));
    if (sourceUrl) assertToolSource(sourceUrl, allowedUrls, `Comparable title ${title}`);
    const price = item.price === undefined ? undefined : numberValue(item.price, `Comparable title ${title} price`);
    return { title, ...(item.author ? { author: text(item.author, `Comparable title ${title} author`) } : {}), ...(item.genre ? { genre: text(item.genre, `Comparable title ${title} genre`) } : {}), ...(price !== undefined ? { price } : {}), ...(item.currency ? { currency: text(item.currency, `Comparable title ${title} currency`) } : {}), ...(item.publishedDate ? { publishedDate: text(item.publishedDate, `Comparable title ${title} published date`) } : {}), ...(sourceUrl ? { sourceUrl } : {}), observedAt };
  });
}

function normalizeAssessment(value: unknown): MarketOpportunityAssessment {
  const item = objectValue(value, "Market assessment");
  return { level: enumValue(item.level, ["low", "moderate", "promising", "high"] as const, "Market assessment level"), rationale: text(item.rationale, "Market assessment rationale"), signals: stringArray(item.signals, "Market assessment signals"), limitations: stringArray(item.limitations, "Market assessment limitations"), disclaimer: DISCLAIMER };
}

function collectWebSearchSourceUrls(payload: Record<string, unknown>): Set<string> {
  const urls = new Set<string>();
  const visit = (value: unknown, inSources = false): void => {
    if (Array.isArray(value)) { for (const item of value) visit(item, inSources); return; }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const isWebSearch = record.type === "web_search_call" || inSources;
    if (isWebSearch && typeof record.url === "string") { try { urls.add(canonicalUrl(record.url)); } catch {} }
    for (const [key, child] of Object.entries(record)) visit(child, isWebSearch || key === "sources");
  };
  visit(payload.output);
  return urls;
}

function extractOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") parts.push(String((part as Record<string, unknown>).text));
  }
  const textValue = parts.join("\n").trim();
  if (!textValue) throw new Error("OpenAI market research returned no structured text output.");
  return textValue;
}

function assertToolSource(url: string, allowed: ReadonlySet<string>, label: string): void { if (!allowed.has(url)) throw new Error(`${label} cites a URL that was not returned by the web-search tool.`); }
function assertEvidenceRefs(refs: readonly string[], allowed: ReadonlySet<string>, label: string): void { for (const ref of refs) if (!allowed.has(ref)) throw new Error(`${label} references missing evidence "${ref}".`); }
function validateRequest(request: KdpMarketIntelligenceProviderRequest): void { if (!request.question?.trim()) throw new Error("Market intelligence question is required."); if (!request.market?.trim()) throw new Error("Market is required."); if (!request.projectId?.trim()) throw new Error("Market intelligence project id is required."); }
function arrayOfObjects(value: unknown, label: string): Record<string, unknown>[] { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); return value.map((item) => objectValue(item, `${label} entry`)); }
function objectValue(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`); return value as Record<string, unknown>; }
function text(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function stringArray(value: unknown, label: string): string[] { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); return [...new Set(value.map((item) => text(item, label)))]; }
function numberValue(value: unknown, label: string): number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`); return value; }
function score(value: unknown, label: string): number { const parsed = numberValue(value, label); if (parsed < 0 || parsed > 100) throw new Error(`${label} must be between 0 and 100.`); return parsed; }
function enumValue<const T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] { if (typeof value !== "string" || !allowed.includes(value)) throw new Error(`${label} is invalid.`); return value as T[number]; }
function optionalTimestamp(value: unknown, label: string): string | undefined { if (value === undefined || value === null || value === "") return undefined; const raw = text(value, label); if (Number.isNaN(Date.parse(raw))) throw new Error(`${label} must be a valid timestamp.`); return new Date(Date.parse(raw)).toISOString(); }
function canonicalUrl(value: string): string { const url = new URL(value); if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Market source URL must use HTTP or HTTPS."); url.hash = ""; return url.toString(); }
function openAiError(payload: Record<string, unknown>, status: number): string { const error = payload.error; if (error && typeof error === "object" && typeof (error as Record<string, unknown>).message === "string") return `OpenAI market research failed (${status}): ${(error as Record<string, unknown>).message}`; return `OpenAI market research failed (${status}).`; }
