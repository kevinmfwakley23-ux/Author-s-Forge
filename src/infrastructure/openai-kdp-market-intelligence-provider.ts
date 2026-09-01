import type {
  KdpMarketIntelligenceProvider,
  KdpMarketIntelligenceProviderRequest,
  KdpMarketIntelligenceProviderResult,
} from "../application/kdp-market-intelligence";
import type {
  ComparableTitle,
  MarketEvidence,
  MarketKeywordRecommendation,
  MarketNicheOpportunity,
  MarketOpportunityAssessment,
  MarketSignal,
} from "../domain/kdp-market-intelligence";

const DISCLAIMER = "This report describes observable market signals and research evidence. It is not a guarantee, forecast, or promise of sales, rankings, revenue, or commercial performance.";
const SIGNAL_TOPICS = ["genre", "subgenre", "niche", "categories", "competing-titles", "publication-frequency", "reader-expectations", "pricing", "cover-conventions", "title-conventions", "keyword-opportunities", "emerging-niches", "underserved-niches", "comparable-books"] as const;

export interface OpenAiWebMarketResearchOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly endpoint?: string;
  readonly searchContextSize?: "low" | "medium" | "high";
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}

/**
 * Production current-market provider. Search is mandatory, and every URL that
 * becomes Forge evidence must have appeared in the hosted web-search source set.
 */
export class OpenAiWebKdpMarketIntelligenceProvider implements KdpMarketIntelligenceProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly searchContextSize: "low" | "medium" | "high";
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  public constructor(options: OpenAiWebMarketResearchOptions = {}) {
    this.apiKey = options.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
    this.model = options.model?.trim() || process.env.OPENAI_MARKET_RESEARCH_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "";
    this.endpoint = options.endpoint?.trim() || "https://api.openai.com/v1/responses";
    this.searchContextSize = options.searchContextSize ?? "high";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is required for live KDP market research.");
    if (!this.model) throw new Error("OPENAI_MARKET_RESEARCH_MODEL or OPENAI_MODEL is required for live KDP market research.");
  }

  public async research(request: KdpMarketIntelligenceProviderRequest): Promise<KdpMarketIntelligenceProviderResult> {
    validateRequest(request);
    const observedAt = this.now().toISOString();
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        tools: [{ type: "web_search", search_context_size: this.searchContextSize }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        input: [
          { role: "system", content: systemPrompt(observedAt) },
          { role: "user", content: `Market: ${request.market.trim()}\nResearch question: ${request.question.trim()}\nReturn current evidence, observable comparable-title statistics when visible, ranked niche opportunities, and reader-search keyword candidates.` },
        ],
        max_output_tokens: 10000,
      }),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(openAiError(payload, response.status));

    const sourceUrls = collectWebSearchSourceUrls(payload);
    if (!sourceUrls.size) throw new Error("OpenAI market research returned no verifiable web-search sources.");
    const parsed = parseJson(extractOutputText(payload));
    const evidence = normalizeEvidence(parsed.evidence, observedAt, sourceUrls);
    if (!evidence.length) throw new Error("OpenAI market research returned no source-backed market evidence.");
    const evidenceIds = new Set(evidence.map((item) => item.id));
    return {
      evidence,
      signals: normalizeSignals(parsed.signals, evidenceIds),
      comparableTitles: normalizeComparables(parsed.comparableTitles, observedAt, sourceUrls),
      keywordRecommendations: normalizeKeywords(parsed.keywordRecommendations, evidenceIds),
      nicheOpportunities: normalizeNiches(parsed.nicheOpportunities, evidenceIds),
      assessment: normalizeAssessment(parsed.assessment),
    };
  }
}

type ParsedProvider = {
  evidence?: unknown;
  signals?: unknown;
  comparableTitles?: unknown;
  keywordRecommendations?: unknown;
  nicheOpportunities?: unknown;
  assessment?: unknown;
};

function systemPrompt(observedAt: string): string {
  return `You are the current-market research engine for Author's Forge. You MUST use web search before answering. Research observable book-market signals, not guaranteed future sales. Prefer fresh retailer/primary evidence and authoritative publishing guidance; use multiple independent sources where practical and state limitations or contradictions. For keyword discovery, use reader-search language and, where observable, Amazon search-result/search-suggestion patterns rather than inventing isolated terms.\n\nAmazon KDP keyword rules: recommend reader-search language that accurately describes the proposed book/niche; KDP permits up to seven keyword slots; avoid other authors or their titles, sales-rank claims, promotions such as free/on sale, unrelated terms, Amazon program names, HTML, unauthorized brands/trademarks, and metadata manipulation. Keywords should add useful discovery information beyond merely repeating the title/category when a more specific relevant phrase exists.\n\nComparable-title statistics are optional and must be copied only when visible in a consulted source. Never estimate a missing bestseller rank, review count, rating, price, category, publication date, unit sales, revenue, or royalty. A bestseller rank is an observed rank, not a sales count.\n\nReturn ONLY JSON with this shape:\n{\"evidence\":[{\"id\":\"e1\",\"source\":\"site/source\",\"url\":\"https://...\",\"publishedAt\":\"optional ISO timestamp\",\"observation\":\"observed fact\",\"strength\":\"weak|moderate|strong\"}],\"signals\":[{\"id\":\"s1\",\"topic\":\"keyword-opportunities\",\"label\":\"label\",\"observation\":\"bounded inference\",\"direction\":\"positive|negative|mixed|neutral\",\"evidenceIds\":[\"e1\"]}],\"comparableTitles\":[{\"title\":\"title\",\"author\":\"optional\",\"genre\":\"optional\",\"category\":\"optional observed category\",\"price\":0,\"currency\":\"USD\",\"bestSellerRank\":1234,\"reviewCount\":100,\"rating\":4.7,\"publishedDate\":\"optional\",\"sourceUrl\":\"https://...\"}],\"keywordRecommendations\":[{\"phrase\":\"reader search phrase\",\"score\":0,\"rationale\":\"why relevant\",\"evidenceIds\":[\"e1\"],\"recommendedForKdpSlot\":true,\"complianceNotes\":[\"accurate to proposed book\"]}],\"nicheOpportunities\":[{\"niche\":\"specific niche\",\"score\":0,\"demandSignal\":\"low|moderate|high|unknown\",\"competitionSignal\":\"low|moderate|high|unknown\",\"rationale\":\"evidence-based explanation\",\"evidenceIds\":[\"e1\"]}],\"assessment\":{\"level\":\"low|moderate|promising|high\",\"rationale\":\"bounded conclusion\",\"signals\":[\"summary\"],\"limitations\":[\"volatile or unknown factor\"]}}.\n\nAllowed signal topics: ${SIGNAL_TOPICS.join(", ")}. Scores are 0-100 research-priority scores, never predicted sales. Return no more than 20 keyword candidates and 20 niches; mark at most seven keywords recommendedForKdpSlot=true. Every signal, keyword, and niche must reference real evidence IDs. Every evidence URL and comparable sourceUrl must be a page actually consulted by web search. Observation timestamp: ${observedAt}.`;
}

function parseJson(raw: string): ParsedProvider {
  const trimmed = raw.trim();
  const source = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? trimmed;
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("OpenAI market research did not return valid JSON."); }
  return objectValue(parsed, "OpenAI market research JSON") as ParsedProvider;
}

function normalizeEvidence(value: unknown, observedAt: string, sources: ReadonlySet<string>): MarketEvidence[] {
  return objectArray(value, "Market evidence").map((item, index) => {
    const id = text(item.id, `Market evidence ${index + 1} id`);
    const url = canonicalUrl(text(item.url, `Market evidence ${id} URL`));
    assertSource(url, sources, `Market evidence ${id}`);
    const publishedAt = optionalTimestamp(item.publishedAt, `Market evidence ${id} publishedAt`);
    return {
      id,
      source: text(item.source, `Market evidence ${id} source`),
      url,
      observedAt,
      ...(publishedAt ? { publishedAt } : {}),
      observation: text(item.observation, `Market evidence ${id} observation`),
      strength: enumValue(item.strength, ["weak", "moderate", "strong"] as const, `Market evidence ${id} strength`),
    };
  });
}

function normalizeSignals(value: unknown, evidenceIds: ReadonlySet<string>): MarketSignal[] {
  return objectArray(value, "Market signals").map((item, index) => {
    const id = text(item.id, `Market signal ${index + 1} id`);
    const refs = strings(item.evidenceIds, `Market signal ${id} evidence`);
    assertEvidenceRefs(refs, evidenceIds, `Market signal ${id}`);
    return {
      id,
      topic: enumValue(item.topic, SIGNAL_TOPICS, `Market signal ${id} topic`),
      label: text(item.label, `Market signal ${id} label`),
      observation: text(item.observation, `Market signal ${id} observation`),
      direction: enumValue(item.direction, ["positive", "negative", "mixed", "neutral"] as const, `Market signal ${id} direction`),
      evidenceIds: refs,
    };
  });
}

function normalizeKeywords(value: unknown, evidenceIds: ReadonlySet<string>): MarketKeywordRecommendation[] {
  const rows = objectArray(value ?? [], "Keyword recommendations");
  if (rows.length > 20) throw new Error("OpenAI market research returned more than 20 keyword candidates.");
  const result = rows.map((item, index) => {
    const phrase = text(item.phrase, `Keyword ${index + 1} phrase`);
    const refs = strings(item.evidenceIds, `Keyword ${phrase} evidence`);
    assertEvidenceRefs(refs, evidenceIds, `Keyword ${phrase}`);
    return {
      phrase,
      score: score(item.score, `Keyword ${phrase} score`),
      rationale: text(item.rationale, `Keyword ${phrase} rationale`),
      evidenceIds: refs,
      recommendedForKdpSlot: item.recommendedForKdpSlot === true,
      complianceNotes: strings(item.complianceNotes ?? [], `Keyword ${phrase} compliance notes`),
    };
  });
  if (result.filter((item) => item.recommendedForKdpSlot).length > 7) throw new Error("OpenAI market research recommended more than seven KDP keyword slots.");
  return result.sort((left, right) => right.score - left.score || left.phrase.localeCompare(right.phrase));
}

function normalizeNiches(value: unknown, evidenceIds: ReadonlySet<string>): MarketNicheOpportunity[] {
  const rows = objectArray(value ?? [], "Niche opportunities");
  if (rows.length > 20) throw new Error("OpenAI market research returned more than 20 niche opportunities.");
  return rows.map((item, index) => {
    const niche = text(item.niche, `Niche ${index + 1}`);
    const refs = strings(item.evidenceIds, `Niche ${niche} evidence`);
    assertEvidenceRefs(refs, evidenceIds, `Niche ${niche}`);
    return {
      niche,
      score: score(item.score, `Niche ${niche} score`),
      demandSignal: enumValue(item.demandSignal, ["low", "moderate", "high", "unknown"] as const, `Niche ${niche} demand`),
      competitionSignal: enumValue(item.competitionSignal, ["low", "moderate", "high", "unknown"] as const, `Niche ${niche} competition`),
      rationale: text(item.rationale, `Niche ${niche} rationale`),
      evidenceIds: refs,
    };
  }).sort((left, right) => right.score - left.score || left.niche.localeCompare(right.niche));
}

function normalizeComparables(value: unknown, observedAt: string, sources: ReadonlySet<string>): ComparableTitle[] {
  return objectArray(value ?? [], "Comparable titles").map((item, index) => {
    const title = text(item.title, `Comparable title ${index + 1}`);
    const sourceUrl = item.sourceUrl === undefined ? undefined : canonicalUrl(text(item.sourceUrl, `Comparable title ${title} source URL`));
    if (sourceUrl) assertSource(sourceUrl, sources, `Comparable title ${title}`);
    const price = optionalNumber(item.price, `Comparable title ${title} price`, 0);
    const bestSellerRank = optionalInteger(item.bestSellerRank, `Comparable title ${title} bestseller rank`, 1);
    const reviewCount = optionalInteger(item.reviewCount, `Comparable title ${title} review count`, 0);
    const rating = optionalNumber(item.rating, `Comparable title ${title} rating`, 0, 5);
    return {
      title,
      ...(item.author ? { author: text(item.author, `Comparable title ${title} author`) } : {}),
      ...(item.genre ? { genre: text(item.genre, `Comparable title ${title} genre`) } : {}),
      ...(item.category ? { category: text(item.category, `Comparable title ${title} category`) } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(item.currency ? { currency: text(item.currency, `Comparable title ${title} currency`) } : {}),
      ...(bestSellerRank !== undefined ? { bestSellerRank } : {}),
      ...(reviewCount !== undefined ? { reviewCount } : {}),
      ...(rating !== undefined ? { rating } : {}),
      ...(item.publishedDate ? { publishedDate: text(item.publishedDate, `Comparable title ${title} published date`) } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      observedAt,
    };
  });
}

function normalizeAssessment(value: unknown): MarketOpportunityAssessment {
  const item = objectValue(value, "Market assessment");
  return {
    level: enumValue(item.level, ["low", "moderate", "promising", "high"] as const, "Market assessment level"),
    rationale: text(item.rationale, "Market assessment rationale"),
    signals: strings(item.signals, "Market assessment signals"),
    limitations: strings(item.limitations, "Market assessment limitations"),
    disclaimer: DISCLAIMER,
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
    Object.entries(record).forEach(([key, child]) => visit(child, search || key === "sources"));
  };
  visit(payload.output);
  return urls;
}

function extractOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts: string[] = [];
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") parts.push(String((part as Record<string, unknown>).text));
  }
  const result = parts.join("\n").trim();
  if (!result) throw new Error("OpenAI market research returned no structured text output.");
  return result;
}

function validateRequest(request: KdpMarketIntelligenceProviderRequest): void {
  text(request.projectId, "Market intelligence project id");
  text(request.market, "Market");
  text(request.question, "Market intelligence question");
}
function assertSource(url: string, allowed: ReadonlySet<string>, label: string): void { if (!allowed.has(url)) throw new Error(`${label} cites a URL that was not returned by the web-search tool.`); }
function assertEvidenceRefs(refs: readonly string[], allowed: ReadonlySet<string>, label: string): void { for (const ref of refs) if (!allowed.has(ref)) throw new Error(`${label} references missing evidence "${ref}".`); }
function objectArray(value: unknown, label: string): Record<string, unknown>[] { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); return value.map((item) => objectValue(item, `${label} entry`)); }
function objectValue(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`); return value as Record<string, unknown>; }
function text(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function strings(value: unknown, label: string): string[] { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); return [...new Set(value.map((item) => text(item, label)))]; }
function finiteNumber(value: unknown, label: string): number { if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`); return value; }
function optionalNumber(value: unknown, label: string, min: number, max = Number.POSITIVE_INFINITY): number | undefined { if (value === undefined || value === null || value === "") return undefined; const result = finiteNumber(value, label); if (result < min || result > max) throw new Error(`${label} is outside its allowed range.`); return result; }
function optionalInteger(value: unknown, label: string, min: number): number | undefined { const result = optionalNumber(value, label, min); if (result !== undefined && !Number.isInteger(result)) throw new Error(`${label} must be an integer.`); return result; }
function score(value: unknown, label: string): number { const result = finiteNumber(value, label); if (result < 0 || result > 100) throw new Error(`${label} must be between 0 and 100.`); return result; }
function enumValue<const T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] { if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new Error(`${label} is invalid.`); return value as T[number]; }
function optionalTimestamp(value: unknown, label: string): string | undefined { if (value === undefined || value === null || value === "") return undefined; const raw = text(value, label); if (Number.isNaN(Date.parse(raw))) throw new Error(`${label} must be a valid timestamp.`); return new Date(Date.parse(raw)).toISOString(); }
function canonicalUrl(value: string): string { const url = new URL(value); if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Market source URL must use HTTP or HTTPS."); url.hash = ""; return url.toString(); }
function openAiError(payload: Record<string, unknown>, status: number): string { const error = payload.error; if (error && typeof error === "object" && typeof (error as Record<string, unknown>).message === "string") return `OpenAI market research failed (${status}): ${(error as Record<string, unknown>).message}`; return `OpenAI market research failed (${status}).`; }
