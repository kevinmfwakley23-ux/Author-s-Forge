export const RESEARCH_HONESTY_FORMAT_VERSION = 1 as const;
export const RESEARCH_HONESTY_CLASSES = ["known-fact", "source-supported", "likely-inference", "creative-fiction", "uncertain"] as const;
export type ResearchHonestyClass = typeof RESEARCH_HONESTY_CLASSES[number];
export type EvidenceStrength = "none" | "indirect" | "direct";

export interface ResearchHonestyAssessment {
  readonly id: string;
  readonly claimId: string;
  readonly classification: ResearchHonestyClass;
  readonly evidenceStrength: EvidenceStrength;
  readonly explanation: string;
  readonly sourceBacked: boolean;
  readonly canonEligible: boolean;
  readonly assessedAt: string;
}

export interface ResearchHonestyRecord {
  readonly id: string;
  readonly projectId: string;
  readonly claimId: string;
  readonly classification: ResearchHonestyClass;
  readonly evidenceStrength: EvidenceStrength;
  readonly explanation: string;
  readonly sourceBacked: boolean;
  readonly canonEligible: boolean;
  readonly assessedAt: string;
}

export interface ResearchHonestyInput {
  readonly id: string;
  readonly projectId: string;
  readonly claimId: string;
  readonly classification: ResearchHonestyClass;
  readonly evidenceStrength: EvidenceStrength;
  readonly explanation: string;
  readonly sourceBacked?: boolean;
  readonly now?: string;
}

export function createResearchHonestyRecord(input: ResearchHonestyInput): ResearchHonestyRecord {
  required(input.id, "Research honesty id"); required(input.projectId, "Research honesty project id"); required(input.claimId, "Research claim id"); required(input.explanation, "Research honesty explanation");
  if (!RESEARCH_HONESTY_CLASSES.includes(input.classification)) throw new Error(`Unknown research honesty classification "${input.classification}".`);
  if (!["none", "indirect", "direct"].includes(input.evidenceStrength)) throw new Error(`Unknown evidence strength "${input.evidenceStrength}".`);
  const sourceBacked = input.sourceBacked ?? input.evidenceStrength === "direct";
  if ((input.classification === "known-fact" || input.classification === "source-supported") && (!sourceBacked || input.evidenceStrength !== "direct")) throw new Error(`${input.classification} requires direct source-backed evidence.`);
  if (input.classification === "likely-inference" && input.evidenceStrength === "none") throw new Error("Likely inference requires evidence.");
  if (input.classification === "creative-fiction" && sourceBacked) throw new Error("Creative fiction cannot be marked source-backed.");
  if (input.classification === "uncertain" && input.evidenceStrength === "direct") throw new Error("Uncertain claims cannot have direct evidence.");
  const assessedAt = input.now ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(assessedAt))) throw new Error("Research assessment date must be a valid date.");
  return { id: input.id, projectId: input.projectId, claimId: input.claimId, classification: input.classification, evidenceStrength: input.evidenceStrength, explanation: input.explanation.trim(), sourceBacked, canonEligible: input.classification === "known-fact" || input.classification === "source-supported", assessedAt };
}

export function isResearchHonest(record: ResearchHonestyRecord): boolean {
  if (record.classification === "known-fact" || record.classification === "source-supported") return record.sourceBacked && record.evidenceStrength === "direct";
  if (record.classification === "likely-inference") return record.evidenceStrength !== "none";
  if (record.classification === "creative-fiction") return !record.sourceBacked;
  return record.evidenceStrength !== "direct";
}

export function assertResearchHonest(record: ResearchHonestyRecord): void { if (!isResearchHonest(record)) throw new Error(`Research honesty record "${record.id}" violates its evidence classification.`); }
function required(value: string, label: string): void { if (!value.trim()) throw new Error(`${label} is required.`); }
