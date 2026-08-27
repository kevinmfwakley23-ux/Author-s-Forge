import { createMemoryRecord, type MemoryRecord } from "../domain/memory";
import { ProjectMemoryStore } from "./project-memory-store";
import { createResearchClaim, createResearchRecord, RESEARCH_DOMAINS, type ResearchClaim, type ResearchDomain, type ResearchRecord } from "../domain/research";

export interface ResearchRequest {
  readonly id: string;
  readonly projectId: string;
  readonly question: string;
  readonly researchedBecause: string;
  readonly domain: ResearchDomain;
  readonly bookId?: string;
  readonly chapterId?: string;
  readonly sceneId?: string;
}

export interface ResearchProviderRequest { readonly question: string; readonly domain: ResearchDomain; readonly projectId: string; }
export interface ResearchProvider { research(request: ResearchProviderRequest): Promise<readonly ResearchProviderResult[]>; }
export interface ResearchProviderResult {
  readonly source: string; readonly date: string; readonly url: string; readonly claim: string;
  readonly confidence: ResearchClaim["confidence"]; readonly relevance: ResearchClaim["relevance"];
}
export interface ResearchSearchResult { readonly record: ResearchRecord; readonly memories: readonly MemoryRecord[]; }

export class ResearchEngine {
  constructor(private readonly provider: ResearchProvider, private readonly memoryStore: ProjectMemoryStore) {}

  async research(request: ResearchRequest): Promise<ResearchSearchResult> {
    validateRequest(request);
    const results = await this.provider.research({ question: request.question.trim(), domain: request.domain, projectId: request.projectId });
    if (!results.length) throw new Error("Research provider returned no results.");
    const now = new Date().toISOString();
    const claims = results.map((result, index) => createResearchClaim({
      id: `${request.id}:claim-${index + 1}`, projectId: request.projectId, bookId: request.bookId, chapterId: request.chapterId,
      sceneId: request.sceneId, domain: request.domain, researchQuestion: request.question, researchedBecause: request.researchedBecause,
      source: result.source, date: result.date, url: result.url, claim: result.claim, confidence: result.confidence, relevance: result.relevance, now
    }));
    const record = createResearchRecord({ id: request.id, projectId: request.projectId, question: request.question, researchedBecause: request.researchedBecause, domain: request.domain, claims, now });
    const memories = claims.map((claim) => createMemoryRecord({
      id: `research:${claim.id}`, projectId: request.projectId, class: "research-memory", authority: "working",
      summary: claim.claim, content: JSON.stringify(claim), provenance: [{ kind: "source", reference: claim.url, recordedAt: now }],
      relevanceTags: [request.domain, ...(request.bookId ? [`book:${request.bookId}`] : []), ...(request.chapterId ? [`chapter:${request.chapterId}`] : []), ...(request.sceneId ? [`scene:${request.sceneId}`] : [])], now
    }));
    memories.forEach((memory) => this.memoryStore.register(memory));
    return { record: cloneRecord(record), memories: memories.map(cloneMemory) };
  }

  retrieve(projectId: string, options: { readonly domain?: ResearchDomain; readonly bookId?: string; readonly chapterId?: string; readonly sceneId?: string; readonly limit?: number } = {}): ResearchClaim[] {
    if (!projectId.trim()) throw new Error("Research project id is required.");
    const tags = [options.bookId && `book:${options.bookId}`, options.chapterId && `chapter:${options.chapterId}`, options.sceneId && `scene:${options.sceneId}`].filter((v): v is string => Boolean(v));
    return this.memoryStore.query({ projectId, class: "research-memory", relevanceTags: tags.length ? tags : undefined, limit: options.limit }).map((memory) => JSON.parse(memory.content) as ResearchClaim).filter((claim) => !options.domain || claim.domain === options.domain);
  }

  listProjectResearch(projectId: string): ResearchClaim[] { return this.retrieve(projectId); }
}

export class StaticResearchProvider implements ResearchProvider {
  constructor(private readonly results: readonly ResearchProviderResult[]) {}
  async research(_request: ResearchProviderRequest): Promise<readonly ResearchProviderResult[]> { return this.results.map((result) => ({ ...result })); }
}

function validateRequest(request: ResearchRequest): void {
  for (const [value, label] of [[request.id, "Research id"], [request.projectId, "Research project id"], [request.question, "Research question"], [request.researchedBecause, "Research rationale"]] as const) if (!value.trim()) throw new Error(`${label} is required.`);
  if (!RESEARCH_DOMAINS.includes(request.domain)) throw new Error(`Unsupported research domain "${request.domain}".`);
}
function cloneClaim(c: ResearchClaim): ResearchClaim { return { ...c }; }
function cloneRecord(r: ResearchRecord): ResearchRecord { return { ...r, claims: r.claims.map(cloneClaim) }; }
function cloneMemory(m: MemoryRecord): MemoryRecord { return { ...m, provenance: m.provenance.map((p) => ({ ...p })), relatedMemoryIds: [...m.relatedMemoryIds], relevanceTags: [...m.relevanceTags] }; }
