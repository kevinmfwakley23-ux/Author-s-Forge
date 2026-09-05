import type { AiBillingClass } from "../application/ai-model-broker";

export const AI_MODEL_PERFORMANCE_FORMAT_VERSION = 1 as const;
export type AiModelPerformancePhase = "candidate" | "synthesis" | "judge-continuity" | "judge-voice";

export interface AiModelPerformanceObservation {
  readonly formatVersion: typeof AI_MODEL_PERFORMANCE_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly ensembleId: string;
  readonly task: string;
  readonly provider: string;
  readonly model: string;
  readonly phase: AiModelPerformancePhase;
  readonly billingClass?: AiBillingClass;
  readonly qualityScore?: number;
  readonly accepted: boolean;
  readonly latencyMs?: number;
  readonly editorialFindingCount?: number;
  readonly editorialBlockingCount?: number;
  readonly createdAt: string;
}

export interface AiModelPerformanceAggregate {
  readonly provider: string;
  readonly model: string;
  readonly billingClass?: AiBillingClass;
  readonly samples: number;
  readonly candidateSamples: number;
  readonly synthesisSamples: number;
  readonly judgeSamples: number;
  readonly passRate: number;
  readonly averageQualityScore?: number;
  readonly averageCandidateLatencyMs?: number;
  readonly recommendationEvidence: "insufficient" | "usable";
  readonly bestValueScore?: number;
}

export function createAiModelPerformanceObservation(input: Omit<AiModelPerformanceObservation, "formatVersion">): AiModelPerformanceObservation {
  required(input.id, "Model performance observation id");
  required(input.projectId, "Model performance project id");
  required(input.ensembleId, "Model performance ensemble id");
  required(input.task, "Model performance task");
  required(input.provider, "Model performance provider");
  required(input.model, "Model performance model");
  if (!["candidate", "synthesis", "judge-continuity", "judge-voice"].includes(input.phase)) throw new Error("Invalid model performance phase.");
  if (input.qualityScore !== undefined && (!Number.isFinite(input.qualityScore) || input.qualityScore < 0 || input.qualityScore > 100)) throw new Error("Model performance quality score must be 0-100.");
  if (input.latencyMs !== undefined && (!Number.isFinite(input.latencyMs) || input.latencyMs < 0)) throw new Error("Model performance latency must be non-negative.");
  for (const [label, value] of [["editorial finding count", input.editorialFindingCount], ["editorial blocking count", input.editorialBlockingCount]] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) throw new Error(`Model performance ${label} must be a non-negative integer.`);
  }
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("Model performance timestamp must be valid.");
  return Object.freeze({ ...input, formatVersion: AI_MODEL_PERFORMANCE_FORMAT_VERSION });
}

export function validateAiModelPerformanceObservation(value: AiModelPerformanceObservation): AiModelPerformanceObservation {
  if (value.formatVersion !== AI_MODEL_PERFORMANCE_FORMAT_VERSION) throw new Error("Unsupported AI model performance format.");
  const { formatVersion: _formatVersion, ...input } = value;
  return createAiModelPerformanceObservation(input);
}

export function aggregateAiModelPerformance(observations: readonly AiModelPerformanceObservation[], minimumSamples = 3): AiModelPerformanceAggregate[] {
  if (!Number.isInteger(minimumSamples) || minimumSamples < 1) throw new Error("Model performance minimum sample count must be a positive integer.");
  const groups = new Map<string, AiModelPerformanceObservation[]>();
  for (const observation of observations) {
    validateAiModelPerformanceObservation(observation);
    const key = `${observation.provider}::${observation.model}`;
    const list = groups.get(key) ?? [];
    list.push(observation);
    groups.set(key, list);
  }
  return [...groups.values()].map((list) => aggregateGroup(list, minimumSamples)).sort((a, b) => {
    const aScore = a.bestValueScore ?? -1, bScore = b.bestValueScore ?? -1;
    return bScore - aScore || b.passRate - a.passRate || (b.averageQualityScore ?? 0) - (a.averageQualityScore ?? 0) || a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model);
  });
}

function aggregateGroup(list: readonly AiModelPerformanceObservation[], minimumSamples: number): AiModelPerformanceAggregate {
  const first = list[0];
  if (!first) throw new Error("Cannot aggregate an empty model performance group.");
  const scores = list.flatMap((item) => item.qualityScore === undefined ? [] : [item.qualityScore]);
  const candidateLatencies = list.flatMap((item) => item.phase === "candidate" && item.latencyMs !== undefined ? [item.latencyMs] : []);
  const passRate = list.filter((item) => item.accepted).length / list.length;
  const averageQualityScore = scores.length ? average(scores) : undefined;
  const averageCandidateLatencyMs = candidateLatencies.length ? average(candidateLatencies) : undefined;
  const recommendationEvidence = list.length >= minimumSamples ? "usable" : "insufficient";
  const billingClass = mostRecentBilling(list);
  const bestValueScore = recommendationEvidence === "usable"
    ? calculateBestValueScore(averageQualityScore ?? 0, passRate, averageCandidateLatencyMs, billingClass)
    : undefined;
  return {
    provider: first.provider,
    model: first.model,
    ...(billingClass ? { billingClass } : {}),
    samples: list.length,
    candidateSamples: list.filter((item) => item.phase === "candidate").length,
    synthesisSamples: list.filter((item) => item.phase === "synthesis").length,
    judgeSamples: list.filter((item) => item.phase.startsWith("judge-")).length,
    passRate,
    ...(averageQualityScore === undefined ? {} : { averageQualityScore }),
    ...(averageCandidateLatencyMs === undefined ? {} : { averageCandidateLatencyMs }),
    recommendationEvidence,
    ...(bestValueScore === undefined ? {} : { bestValueScore }),
  };
}
function calculateBestValueScore(quality: number, passRate: number, latencyMs: number | undefined, billing: AiBillingClass | undefined): number {
  const qualityComponent = quality * 0.6;
  const reliabilityComponent = passRate * 25;
  const latencyComponent = latencyMs === undefined ? 0 : Math.max(0, 10 - Math.min(10, latencyMs / 1000));
  const affordabilityComponent = billing === "local" || billing === "free" ? 10 : billing === "subscription" ? 8 : billing === "metered" ? 2 : 0;
  return Math.round((qualityComponent + reliabilityComponent + latencyComponent + affordabilityComponent) * 100) / 100;
}
function mostRecentBilling(list: readonly AiModelPerformanceObservation[]): AiBillingClass | undefined {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).find((item) => item.billingClass)?.billingClass;
}
function average(values: readonly number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function required(value: string, label: string): void { if (!value.trim()) throw new Error(`${label} is required.`); }
