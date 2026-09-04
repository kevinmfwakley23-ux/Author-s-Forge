import { randomUUID } from "node:crypto";
import { AiFederation } from "./ai-federation";
import { AiModelBroker, type AiBillingClass, type AiModelSelection, type AiSpendPolicy } from "./ai-model-broker";
import { estimateTokens } from "./context-optimizer";
import { IntelligentEditingService } from "./intelligent-editing";
import { EDITOR_ROLES, type EditorialFinding, type EditorialReport } from "../domain/intelligent-editing";
import { aiConfiguredResources, generateText, type AiGenerationRequest, type AiGenerationResult } from "../infrastructure/ai-provider";
import { loadAiModelRuntimeOptions, type AiModelRuntimeOptions } from "../infrastructure/ai-model-options-runtime";

export const AI_ENSEMBLE_FORMAT_VERSION = 1 as const;

export interface AiEnsembleWorkerResult {
  readonly assignedProvider: string;
  readonly assignedModel: string;
  readonly actualProvider: AiGenerationResult["provider"];
  readonly actualModel: string;
  readonly billingClass?: AiBillingClass;
  readonly qualityScore: number;
  readonly latencyMs: number;
  readonly fallbackUsed: boolean;
  readonly text: string;
}

export interface AiEnsembleJudgeResult {
  readonly kind: "continuity" | "voice";
  readonly accepted: boolean;
  readonly score: number;
  readonly failures: readonly string[];
  readonly warnings: readonly string[];
  readonly evidence: readonly string[];
  readonly provider?: AiGenerationResult["provider"];
  readonly model?: string;
}

export interface AiEnsembleEditorialGate {
  readonly report: EditorialReport;
  readonly blockingFindings: readonly EditorialFinding[];
}

export interface AiTextEnsembleResult {
  readonly formatVersion: typeof AI_ENSEMBLE_FORMAT_VERSION;
  readonly id: string;
  readonly mode: "single" | "parallel";
  readonly requestedWorkers: number;
  readonly completedWorkers: number;
  readonly uniqueModelsUsed: readonly string[];
  readonly workers: readonly AiEnsembleWorkerResult[];
  readonly synthesis?: { readonly provider: AiGenerationResult["provider"]; readonly model: string; readonly qualityScore: number };
  readonly judges: readonly AiEnsembleJudgeResult[];
  readonly editorial: AiEnsembleEditorialGate;
  readonly budget: {
    readonly spendPolicy: AiSpendPolicy;
    readonly maxTotalEstimatedCostUsd?: number;
    readonly perCallEstimatedCostCeilingUsd?: number;
    readonly reservedCallCount: number;
  };
  readonly accepted: boolean;
  readonly blockedReasons: readonly string[];
  readonly finalText: string;
  readonly createdAt: string;
}

export interface AiTextEnsembleRequest {
  readonly system: string;
  readonly user: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly sourceText?: string;
  readonly projectId?: string;
  readonly title?: string;
}

export type AiTextEnsembleGenerator = (request: AiGenerationRequest) => Promise<AiGenerationResult>;
export interface AiTextEnsembleRuntime {
  readonly generate?: AiTextEnsembleGenerator;
  readonly resources?: ReturnType<typeof aiConfiguredResources>;
  readonly options?: AiModelRuntimeOptions;
}

/**
 * Parallel candidate generation plus fan-in synthesis and independent quality
 * gates. The production default uses the real generateText boundary. Tests may
 * inject a runtime so orchestration can be verified without external providers.
 */
export async function runAiTextEnsemble(request: AiTextEnsembleRequest, runtime: AiTextEnsembleRuntime = {}): Promise<AiTextEnsembleResult> {
  if (!request.system.trim()) throw new Error("AI ensemble system instruction is required.");
  if (!request.user.trim()) throw new Error("AI ensemble user request is required.");

  const generate = runtime.generate ?? generateText;
  const options = runtime.options ?? loadAiModelRuntimeOptions();
  const maxOutputTokens = clampInteger(request.maxOutputTokens ?? 5000, 128, 12000);
  const qualityFloor = options.ensembleMinQualityScore;
  const resources = runtime.resources ?? aiConfiguredResources();
  if (!resources.length) throw new Error("AI ensemble has no configured model resources.");

  const maxWorkers = options.ensembleEnabled ? options.ensembleMaxWorkers : 1;
  // Reserve the worst-case number of calls before fan-out: workers + synthesis
  // when multi-worker + continuity judge + voice judge. Using the configured
  // worker maximum makes this deliberately conservative if fewer models survive.
  const reservedCallCount = maxWorkers + (maxWorkers > 1 ? 1 : 0) + 2;
  const totalCap = options.ensembleMaxTotalEstimatedCostUsd;
  const perCallFromTotal = totalCap === undefined ? undefined : totalCap / reservedCallCount;
  const ownerPerRequestCap = nonnegative(process.env.AI_MAX_REQUEST_COST_USD);
  const perCallCeiling = minimumDefined(ownerPerRequestCap, perCallFromTotal);
  const ownerSpendPolicy = spendPolicy();
  // A user-specified ensemble total cap must remain meaningful even if the
  // general owner mode is unrestricted. No-paid-tokens remains stricter.
  const ensembleSpendPolicy: AiSpendPolicy = totalCap !== undefined && ownerSpendPolicy !== "no-paid-tokens" ? "budgeted" : ownerSpendPolicy;

  const broker = new AiModelBroker();
  broker.setResources(resources);
  const estimatedInputTokens = estimateTokens(`${request.system}\n\n${request.user}`);
  const federation = new AiFederation(broker);
  const plan = federation.plan({
    task: "writing",
    routingMode: routingMode(),
    spendPolicy: ensembleSpendPolicy,
    trustedNoSpendModels: csv(process.env.AI_TRUSTED_NO_SPEND_MODELS),
    maxEstimatedRequestCostUsd: perCallCeiling,
    estimatedInputTokens,
    estimatedOutputTokens: Math.min(maxOutputTokens, 3000),
    minimumContextWindow: estimatedInputTokens + Math.min(maxOutputTokens, 3000),
    minimumOutputTokens: Math.min(maxOutputTokens, 3000),
    quotaSafetyFraction: fraction(process.env.AI_QUOTA_SAFETY_FRACTION) ?? 0.1,
    preferredProviders: csv(process.env.AI_PROVIDER_ORDER),
    requiresCreativeWriting: true,
    requiresInstructionFollowing: true,
  }, maxWorkers);
  if (!plan.candidates.length) throw new Error("No AI model is eligible for the ensemble under the current owner spend, quota, capability, and health rules.");

  const assigned = selectDiverseEnsembleCandidates(plan.candidates, maxWorkers);
  const candidateOutputTokens = Math.min(maxOutputTokens, 3000);
  const candidateCalls = assigned.map(async (selection): Promise<AiEnsembleWorkerResult> => {
    const started = Date.now();
    const result = await generate({
      system: [
        request.system,
        "ENSEMBLE ROLE: Produce one independent high-quality candidate. Do not mention other models. Preserve every supplied canon, author-voice, continuity, and intent constraint. Do not sacrifice correctness for novelty.",
      ].join("\n\n"),
      user: request.user,
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: candidateOutputTokens,
      task: "writing",
      routingMode: routingMode(),
      spendPolicy: ensembleSpendPolicy,
      maxEstimatedRequestCostUsd: perCallCeiling,
      trustedNoSpendModels: csv(process.env.AI_TRUSTED_NO_SPEND_MODELS),
      preferProvider: selection.resource.provider,
      preferModel: selection.resource.model,
      requiresCreativeWriting: true,
      requiresInstructionFollowing: true,
    });
    return {
      assignedProvider: selection.resource.provider,
      assignedModel: selection.resource.model,
      actualProvider: result.provider,
      actualModel: result.model,
      billingClass: resourceBilling(resources, result.provider, result.model) ?? selection.resource.billingClass,
      qualityScore: result.quality?.score ?? 0,
      latencyMs: Date.now() - started,
      fallbackUsed: result.provider !== selection.resource.provider || result.model !== selection.resource.model,
      text: result.text,
    };
  });

  const settled = await Promise.allSettled(candidateCalls);
  const successes = settled.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
  const uniqueWorkers = deduplicateActualModels(successes)
    .filter((worker) => worker.qualityScore >= qualityFloor)
    .sort((a, b) => b.qualityScore - a.qualityScore || a.latencyMs - b.latencyMs);
  if (!uniqueWorkers.length) {
    const failures = settled.flatMap((item) => item.status === "rejected" ? [errorText(item.reason)] : []);
    throw new Error(`AI ensemble produced no candidate at the configured quality floor ${qualityFloor}. ${failures.join(" ")}`.trim());
  }

  let finalText = uniqueWorkers[0].text;
  let synthesis: AiTextEnsembleResult["synthesis"];
  if (uniqueWorkers.length > 1) {
    const synthesisResult = await generate({
      system: [
        request.system,
        "ENSEMBLE SYNTHESIZER: Combine only the strongest compatible material from the candidate drafts. Project Brain/canon/author constraints outrank candidate consensus. Never average away distinctive author voice. Never introduce a new fact merely because multiple candidates sound plausible. Return only the finished candidate artifact.",
      ].join("\n\n"),
      user: `${request.user}\n\nINDEPENDENT CANDIDATES:\n${uniqueWorkers.map((worker, index) => candidateBlock(worker, index)).join("\n\n")}`,
      temperature: Math.min(0.6, request.temperature ?? 0.55),
      maxOutputTokens,
      task: "writing",
      routingMode: routingMode(),
      spendPolicy: ensembleSpendPolicy,
      maxEstimatedRequestCostUsd: perCallCeiling,
      trustedNoSpendModels: csv(process.env.AI_TRUSTED_NO_SPEND_MODELS),
      requiresCreativeWriting: true,
      requiresInstructionFollowing: true,
    });
    if ((synthesisResult.quality?.score ?? 0) < qualityFloor) throw new Error(`Ensemble synthesis fell below the configured quality floor ${qualityFloor}.`);
    finalText = synthesisResult.text;
    synthesis = { provider: synthesisResult.provider, model: synthesisResult.model, qualityScore: synthesisResult.quality?.score ?? 0 };
  }

  const editorial = runEditingOffice(finalText, request);
  const judges = await Promise.all([
    runJudge("continuity", request, finalText, qualityFloor, uniqueWorkers.at(-1), generate, ensembleSpendPolicy, perCallCeiling),
    runJudge("voice", request, finalText, qualityFloor, uniqueWorkers.length > 1 ? uniqueWorkers[1] : uniqueWorkers[0], generate, ensembleSpendPolicy, perCallCeiling),
  ]);
  const blockedReasons: string[] = [];
  for (const judge of judges) {
    if (!judge.accepted || judge.score < qualityFloor) blockedReasons.push(`${judge.kind} anti-drift gate rejected the candidate at ${judge.score}/${qualityFloor}${judge.failures.length ? `: ${judge.failures.join("; ")}` : ""}`);
  }
  if (editorial.blockingFindings.length) blockedReasons.push(`Editing Office found ${editorial.blockingFindings.length} blocking continuity/quality issue(s).`);

  return {
    formatVersion: AI_ENSEMBLE_FORMAT_VERSION,
    id: `ensemble-${randomUUID()}`,
    mode: uniqueWorkers.length > 1 ? "parallel" : "single",
    requestedWorkers: assigned.length,
    completedWorkers: successes.length,
    uniqueModelsUsed: uniqueWorkers.map((worker) => `${worker.actualProvider}/${worker.actualModel}`),
    workers: uniqueWorkers,
    ...(synthesis ? { synthesis } : {}),
    judges,
    editorial,
    budget: {
      spendPolicy: ensembleSpendPolicy,
      ...(totalCap === undefined ? {} : { maxTotalEstimatedCostUsd: totalCap }),
      ...(perCallCeiling === undefined ? {} : { perCallEstimatedCostCeilingUsd: perCallCeiling }),
      reservedCallCount,
    },
    accepted: blockedReasons.length === 0,
    blockedReasons,
    finalText,
    createdAt: new Date().toISOString(),
  };
}

export function selectDiverseEnsembleCandidates(candidates: readonly AiModelSelection[], max: number): AiModelSelection[] {
  const selected: AiModelSelection[] = [];
  const providers = new Set<string>();
  for (const candidate of candidates) {
    if (selected.length >= max) break;
    if (providers.has(candidate.resource.provider)) continue;
    selected.push(candidate); providers.add(candidate.resource.provider);
  }
  for (const candidate of candidates) {
    if (selected.length >= max) break;
    if (selected.some((item) => item.resource.provider === candidate.resource.provider && item.resource.model === candidate.resource.model)) continue;
    selected.push(candidate);
  }
  return selected;
}

export function parseAiEnsembleJudge(text: string): Omit<AiEnsembleJudgeResult, "kind" | "provider" | "model"> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const first = cleaned.indexOf("{"); const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("Anti-drift judge returned no JSON object.");
  const value = JSON.parse(cleaned.slice(first, last + 1)) as Record<string, unknown>;
  if (typeof value.accepted !== "boolean") throw new Error("Anti-drift judge omitted accepted boolean.");
  const score = Number(value.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error("Anti-drift judge score must be 0-100.");
  return {
    accepted: value.accepted,
    score: Math.round(score),
    failures: stringArray(value.failures),
    warnings: stringArray(value.warnings),
    evidence: stringArray(value.evidence),
  };
}

function deduplicateActualModels(workers: readonly AiEnsembleWorkerResult[]): AiEnsembleWorkerResult[] {
  const best = new Map<string, AiEnsembleWorkerResult>();
  for (const worker of workers) {
    const key = `${worker.actualProvider}/${worker.actualModel}`;
    const current = best.get(key);
    if (!current || worker.qualityScore > current.qualityScore || (worker.qualityScore === current.qualityScore && worker.latencyMs < current.latencyMs)) best.set(key, worker);
  }
  return [...best.values()];
}
function candidateBlock(worker: AiEnsembleWorkerResult, index: number): string {
  return [`--- Candidate ${index + 1} (${worker.actualProvider}/${worker.actualModel}; quality ${worker.qualityScore}) ---`, worker.text].join("\n");
}
function runEditingOffice(text: string, request: AiTextEnsembleRequest): AiEnsembleEditorialGate {
  const service = new IntelligentEditingService();
  const report = service.analyze({
    document: {
      target: { projectId: request.projectId?.trim() || "ensemble", manuscriptId: "ensemble-candidate" },
      title: request.title?.trim() || "Multi-model ensemble candidate",
      text,
    },
    roles: EDITOR_ROLES,
    reportId: `ensemble-editor-${randomUUID()}`,
  });
  const blockingFindings = report.findings.filter((finding) => {
    if (finding.severity === "critical") return true;
    if (finding.severity !== "warning" || finding.confidence < 0.8) return false;
    return ["continuity-conflict", "character-consistency", "pov-violation", "tense-inconsistency", "plot-hole"].includes(finding.kind);
  });
  return { report, blockingFindings };
}
async function runJudge(
  kind: "continuity" | "voice",
  request: AiTextEnsembleRequest,
  finalText: string,
  qualityFloor: number,
  preferred: AiEnsembleWorkerResult | undefined,
  generate: AiTextEnsembleGenerator,
  ensembleSpendPolicy: AiSpendPolicy,
  perCallCeiling: number | undefined,
): Promise<AiEnsembleJudgeResult> {
  const task = kind === "continuity" ? "continuity" : "voice-preservation";
  const criterion = kind === "continuity"
    ? "Check the candidate against every supplied canon fact, chronology, relationship, character state, POV/tense instruction, and author intent. Treat unsupported inventions and contradictions as failures."
    : "Check whether the candidate preserves the supplied author voice, narrative distance, rhythm, emotional intent, dialogue/description balance, and wording character. Generic model voice or stylistic homogenization is a failure.";
  try {
    const result = await generate({
      system: `${request.system}\n\nINDEPENDENT ANTI-DRIFT JUDGE. ${criterion} Do not rewrite the candidate. Return strict JSON only.`,
      user: [
        "ORIGINAL REQUEST AND GOVERNED CONTEXT:", request.user,
        request.sourceText?.trim() ? `SOURCE TEXT TO PRESERVE/IMPROVE:\n${request.sourceText}` : "",
        `CANDIDATE TO JUDGE:\n${finalText}`,
        `Return exactly this JSON shape: {"accepted":boolean,"score":0-100,"failures":string[],"warnings":string[],"evidence":string[]}. A score below ${qualityFloor} must set accepted=false.`,
      ].filter(Boolean).join("\n\n"),
      temperature: 0,
      maxOutputTokens: 1200,
      task,
      routingMode: routingMode(),
      spendPolicy: ensembleSpendPolicy,
      maxEstimatedRequestCostUsd: perCallCeiling,
      trustedNoSpendModels: csv(process.env.AI_TRUSTED_NO_SPEND_MODELS),
      preferProvider: preferred?.actualProvider,
      preferModel: preferred?.actualModel,
      requiresInstructionFollowing: true,
    });
    const parsed = parseAiEnsembleJudge(result.text);
    return { kind, ...parsed, provider: result.provider, model: result.model };
  } catch (error) {
    return { kind, accepted: false, score: 0, failures: [`Judge execution failed closed: ${errorText(error)}`], warnings: [], evidence: [] };
  }
}
function resourceBilling(resources: ReturnType<typeof aiConfiguredResources>, provider: string, model: string): AiBillingClass | undefined {
  return resources.find((resource) => resource.provider === provider && resource.model === model)?.billingClass;
}
function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 50);
}
function spendPolicy(): AiSpendPolicy {
  const value = process.env.AI_SPEND_POLICY?.trim();
  return value === "budgeted" || value === "unrestricted" ? value : "no-paid-tokens";
}
function routingMode(): "economy" | "balanced" | "quality" {
  const value = process.env.AI_ROUTING_MODE?.trim();
  return value === "balanced" || value === "quality" ? value : "economy";
}
function csv(value: string | undefined): string[] { return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? []; }
function nonnegative(value: string | undefined): number | undefined { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined; }
function fraction(value: string | undefined): number | undefined { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 && parsed < 1 ? parsed : undefined; }
function clampInteger(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, Math.round(value))); }
function minimumDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}
function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
