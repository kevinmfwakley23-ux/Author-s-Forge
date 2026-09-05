import { randomUUID } from "node:crypto";
import type { AiBillingClass } from "./ai-model-broker";
import { parseAiEnsembleJudge, type AiTextEnsembleGenerator } from "./ai-ensemble";
import { createAiModelPerformanceObservation, type AiModelPerformanceObservation, type AiModelPerformancePhase } from "../domain/ai-model-performance";
import type { FileAiModelPerformanceStore } from "../infrastructure/file-ai-model-performance-store";
import { aiConfiguredResources, generateText, type AiGenerationRequest, type AiGenerationResult } from "../infrastructure/ai-provider";

export interface AiEnsemblePerformanceTracker {
  readonly ensembleId: string;
  readonly generate: AiTextEnsembleGenerator;
  readonly pending: () => readonly AiModelPerformanceObservation[];
  readonly flush: () => Promise<readonly AiModelPerformanceObservation[]>;
}

/**
 * Wrap the production generator and record what actually happened. The tracker
 * buffers observations in memory so parallel workers do not contend on the
 * ledger file; flush persists them atomically as one batch after the ensemble
 * completes or aborts. No prompt or generated manuscript text is stored here.
 */
export function createAiEnsemblePerformanceTracker(input: {
  projectId: string;
  task: string;
  store: FileAiModelPerformanceStore;
  qualityFloor: number;
  ensembleId?: string;
  delegate?: AiTextEnsembleGenerator;
  resources?: ReturnType<typeof aiConfiguredResources>;
}): AiEnsemblePerformanceTracker {
  if (!input.projectId.trim()) throw new Error("Ensemble performance tracking requires a project id.");
  if (!input.task.trim()) throw new Error("Ensemble performance tracking requires a task.");
  if (!Number.isFinite(input.qualityFloor) || input.qualityFloor < 0 || input.qualityFloor > 100) throw new Error("Ensemble performance quality floor must be 0-100.");
  const delegate = input.delegate ?? generateText;
  const resources = input.resources ?? aiConfiguredResources();
  const ensembleId = input.ensembleId?.trim() || `ensemble-run-${randomUUID()}`;
  const observations: AiModelPerformanceObservation[] = [];
  let flushedCount = 0;

  const generate: AiTextEnsembleGenerator = async (request) => {
    const phase = phaseFromRequest(request);
    const started = Date.now();
    try {
      const result = await delegate(request);
      // generateText exposes every internal failover attempt. Preserve failed
      // model evidence instead of crediting only the eventual winner.
      for (const attempt of result.attempts ?? []) {
        if (attempt.success || !attempt.model) continue;
        observations.push(failedObservation({
          projectId: input.projectId,
          ensembleId,
          task: input.task,
          phase,
          provider: attempt.provider,
          model: attempt.model,
          billingClass: billingFor(resources, attempt.provider, attempt.model),
          latencyMs: attempt.latencyMs,
        }));
      }

      const latencyMs = result.attempts?.find((attempt) => attempt.success && attempt.provider === result.provider && attempt.model === result.model)?.latencyMs
        ?? Date.now() - started;
      const judged = judgeOutcome(phase, result, input.qualityFloor);
      const billing = billingFor(resources, result.provider, result.model);
      observations.push(createAiModelPerformanceObservation({
        id: `model-observation-${randomUUID()}`,
        projectId: input.projectId,
        ensembleId,
        task: input.task,
        provider: result.provider,
        model: result.model,
        phase,
        ...(billing ? { billingClass: billing } : {}),
        ...(judged.qualityScore === undefined ? {} : { qualityScore: judged.qualityScore }),
        accepted: judged.accepted,
        latencyMs,
        createdAt: new Date().toISOString(),
      }));
      return result;
    } catch (error) {
      const provider = request.preferProvider?.trim();
      const model = request.preferModel?.trim();
      // Attribute a total call failure only when the request was explicitly
      // assigned to a provider/model. Unpinned broker failures are not guessed.
      if (provider && model) {
        observations.push(failedObservation({
          projectId: input.projectId,
          ensembleId,
          task: input.task,
          phase,
          provider,
          model,
          billingClass: billingFor(resources, provider, model),
          latencyMs: Date.now() - started,
        }));
      }
      throw error;
    }
  };

  return {
    ensembleId,
    generate,
    pending: () => observations.slice(flushedCount).map(clone),
    flush: async () => {
      const batch = observations.slice(flushedCount);
      if (!batch.length) return [];
      const persisted = await input.store.appendMany(batch);
      flushedCount += batch.length;
      return persisted;
    },
  };
}

function failedObservation(input: {
  projectId: string;
  ensembleId: string;
  task: string;
  phase: AiModelPerformancePhase;
  provider: string;
  model: string;
  billingClass?: AiBillingClass;
  latencyMs: number;
}): AiModelPerformanceObservation {
  return createAiModelPerformanceObservation({
    id: `model-observation-${randomUUID()}`,
    projectId: input.projectId,
    ensembleId: input.ensembleId,
    task: input.task,
    provider: input.provider,
    model: input.model,
    phase: input.phase,
    ...(input.billingClass ? { billingClass: input.billingClass } : {}),
    accepted: false,
    latencyMs: input.latencyMs,
    createdAt: new Date().toISOString(),
  });
}

function phaseFromRequest(request: AiGenerationRequest): AiModelPerformancePhase {
  if (request.system.includes("ENSEMBLE ROLE:")) return "candidate";
  if (request.system.includes("ENSEMBLE SYNTHESIZER:")) return "synthesis";
  if (request.task === "continuity") return "judge-continuity";
  if (request.task === "voice-preservation") return "judge-voice";
  throw new Error(`Unrecognized ensemble performance phase for task "${request.task ?? "unknown"}".`);
}

function judgeOutcome(phase: AiModelPerformancePhase, result: AiGenerationResult, qualityFloor: number): { accepted: boolean; qualityScore?: number } {
  if (phase === "judge-continuity" || phase === "judge-voice") {
    try {
      const judged = parseAiEnsembleJudge(result.text);
      return { accepted: judged.accepted && judged.score >= qualityFloor, qualityScore: judged.score };
    } catch {
      return { accepted: false, qualityScore: 0 };
    }
  }
  const qualityScore = result.quality?.score;
  return { accepted: qualityScore !== undefined && qualityScore >= qualityFloor, ...(qualityScore === undefined ? {} : { qualityScore }) };
}

function billingFor(resources: ReturnType<typeof aiConfiguredResources>, provider: string, model: string): AiBillingClass | undefined {
  return resources.find((resource) => resource.provider === provider && resource.model === model)?.billingClass;
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
