import { ProjectMemoryStore } from "./project-memory-store";
import {
  assertResearchHonest,
  createResearchHonestyRecord,
  type ResearchHonestyClass,
  type ResearchHonestyRecord,
  type EvidenceStrength,
} from "../domain/research-honesty";

export interface ResearchHonestyQuery {
  readonly projectId: string;
  readonly claimId?: string;
  readonly classification?: ResearchHonestyClass;
  readonly canonEligible?: boolean;
  readonly limit?: number;
}

export interface ResearchHonestySummary {
  readonly projectId: string;
  readonly total: number;
  readonly byClassification: Readonly<Record<ResearchHonestyClass, number>>;
  readonly canonEligible: number;
  readonly nonCanonEligible: number;
}

/** Project-scoped persistence boundary for research honesty assessments. */
export class ResearchHonestyService {
  constructor(private readonly memoryStore: ProjectMemoryStore) {}

  assess(input: {
    readonly id: string;
    readonly projectId: string;
    readonly claimId: string;
    readonly classification: ResearchHonestyClass;
    readonly evidenceStrength: EvidenceStrength;
    readonly explanation: string;
    readonly sourceBacked?: boolean;
    readonly now?: string;
  }): ResearchHonestyRecord {
    const record = createResearchHonestyRecord(input);
    assertResearchHonest(record);
    const memory = this.memoryStore.create({
      id: `research-honesty:${record.id}`,
      projectId: record.projectId,
      class: "research-memory",
      authority: "working",
      summary: `${record.assessment.classification}: ${record.assessment.explanation}`,
      content: JSON.stringify(record),
      provenance: [{ kind: "research-honesty", reference: record.assessment.claimId, recordedAt: record.assessment.assessedAt }],
      relevanceTags: ["research-honesty", `claim:${record.claimId}`, `honesty:${record.assessment.classification}`],
      now: record.assessment.assessedAt,
    });
    this.memoryStore.register(memory);
    return clone(record);
  }

  get(query: ResearchHonestyQuery): ResearchHonestyRecord[] {
    if (!query.projectId.trim()) throw new Error("Research honesty project id is required.");
    return this.memoryStore.query({
      projectId: query.projectId,
      class: "research-memory",
      relevanceTags: ["research-honesty"],
      limit: query.limit,
    }).map(memory => JSON.parse(memory.content) as ResearchHonestyRecord)
      .filter(record => !query.claimId || record.claimId === query.claimId)
      .filter(record => !query.classification || record.assessment.classification === query.classification)
      .filter(record => query.canonEligible === undefined || record.assessment.canonEligible === query.canonEligible)
      .filter(record => { assertResearchHonest(record); return true; });
  }

  summarize(projectId: string): ResearchHonestySummary {
    const records = this.get({ projectId });
    const byClassification = {
      "known-fact": 0,
      "source-supported": 0,
      "likely-inference": 0,
      "creative-fiction": 0,
      "uncertain": 0,
    } as Record<ResearchHonestyClass, number>;
    for (const record of records) byClassification[record.assessment.classification] += 1;
    const canonEligible = records.filter(r => r.assessment.canonEligible).length;
    return { projectId, total: records.length, byClassification, canonEligible, nonCanonEligible: records.length - canonEligible };
  }
}

function clone(record: ResearchHonestyRecord): ResearchHonestyRecord {
  return { ...record, assessment: { ...record.assessment } };
}
