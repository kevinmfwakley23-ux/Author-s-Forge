import { createMemoryRecord } from "../domain/memory";
import { ProjectMemoryStore } from "./project-memory-store";
import { assertResearchHonest, createResearchHonestyRecord, type ResearchHonestyClass, type ResearchHonestyRecord, type EvidenceStrength } from "../domain/research-honesty";

export interface ResearchHonestyQuery { readonly projectId: string; readonly claimId?: string; readonly classification?: ResearchHonestyClass; readonly canonEligible?: boolean; readonly limit?: number; }
export interface ResearchHonestySummary { readonly projectId: string; readonly total: number; readonly byClassification: Readonly<Record<ResearchHonestyClass, number>>; readonly canonEligible: number; readonly nonCanonEligible: number; }

export class ResearchHonestyService {
  constructor(private readonly memoryStore: ProjectMemoryStore) {}

  assess(input: { readonly id: string; readonly projectId: string; readonly claimId: string; readonly classification: ResearchHonestyClass; readonly evidenceStrength: EvidenceStrength; readonly explanation: string; readonly sourceBacked?: boolean; readonly now?: string; }): ResearchHonestyRecord {
    const record = createResearchHonestyRecord(input);
    assertResearchHonest(record);
    const now = record.assessedAt;
    const memory = createMemoryRecord({
      id: `research-honesty:${record.id}`, projectId: record.projectId, class: "research-memory", authority: "working",
      summary: `${record.classification}: ${record.explanation}`, content: JSON.stringify(record),
      provenance: [{ kind: "source", reference: record.claimId, recordedAt: now }],
      relevanceTags: ["research-honesty", `claim:${record.claimId}`, `honesty:${record.classification}`], now,
    });
    this.memoryStore.register(memory);
    return clone(record);
  }

  get(query: ResearchHonestyQuery): ResearchHonestyRecord[] {
    if (!query.projectId.trim()) throw new Error("Research honesty project id is required.");
    return this.memoryStore.query({ projectId: query.projectId, class: "research-memory", relevanceTags: ["research-honesty"], limit: query.limit })
      .map(memory => JSON.parse(memory.content) as ResearchHonestyRecord)
      .filter(record => !query.claimId || record.claimId === query.claimId)
      .filter(record => !query.classification || record.classification === query.classification)
      .filter(record => query.canonEligible === undefined || record.canonEligible === query.canonEligible)
      .filter(record => { assertResearchHonest(record); return true; });
  }

  summarize(projectId: string): ResearchHonestySummary {
    const records = this.get({ projectId });
    const byClassification = { "known-fact": 0, "source-supported": 0, "likely-inference": 0, "creative-fiction": 0, "uncertain": 0 } as Record<ResearchHonestyClass, number>;
    for (const record of records) byClassification[record.classification] += 1;
    const canonEligible = records.filter(r => r.canonEligible).length;
    return { projectId, total: records.length, byClassification, canonEligible, nonCanonEligible: records.length - canonEligible };
  }
}
function clone(record: ResearchHonestyRecord): ResearchHonestyRecord { return { ...record }; }
