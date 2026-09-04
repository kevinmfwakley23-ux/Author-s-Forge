import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FileProjectStore } from "../infrastructure/file-project-store";
import type { FileAiProposalStore } from "../infrastructure/file-ai-proposal-store";
import type { FileAiModelPerformanceStore } from "../infrastructure/file-ai-model-performance-store";
import { loadAiModelRuntimeOptions } from "../infrastructure/ai-model-options-runtime";
import { AiWritingCoordinator, type AiWritingGenerator } from "./ai-writing-coordinator";
import { AiWritingStudioService } from "./ai-writing-studio";
import { runAiTextEnsemble, type AiTextEnsembleResult } from "./ai-ensemble";
import { createAiEnsemblePerformanceTracker } from "./ai-ensemble-performance";
import type { AiWritingTask } from "./ai-writing";
import type { AiGenerationResult } from "../infrastructure/ai-provider";

const WRITING_TASKS: readonly AiWritingTask[] = ["draft", "continue", "rewrite", "expand", "dialogue", "description", "outline", "brainstorm"];

export type StudioAiEnsembleRouteHandler = (req: IncomingMessage, res: ServerResponse, url: URL, projectId: string) => Promise<boolean>;

/**
 * Request-scoped ensemble coordinator. The final multi-model candidate still
 * travels through AiWritingStudioService, so Project Brain, voice drift,
 * character continuity, stale-scene protection, proposal review, and explicit
 * Apply remain the canonical manuscript boundary. Real provider observations
 * are captured separately for learned best-value recommendations.
 */
export function createStudioAiEnsembleRoutes(
  store: FileProjectStore,
  proposalStore: FileAiProposalStore,
  performanceStore: FileAiModelPerformanceStore,
): StudioAiEnsembleRouteHandler {
  return async (req, res, url, projectId) => {
    if (url.pathname !== `/api/projects/${projectId}/ai/ensemble-writing` || req.method !== "POST") return false;
    const input = await body(req);
    const task = writingTask(input.task);
    const bookId = required(input.bookId, "Book id");
    const chapterId = required(input.chapterId, "Chapter id");
    const sceneId = required(input.sceneId, "Scene id");
    const instruction = required(input.instruction, "Instruction");
    const proposalId = optional(input.proposalId) ?? `ensemble-proposal-${randomUUID()}`;
    const runtimeOptions = loadAiModelRuntimeOptions();
    const performance = createAiEnsemblePerformanceTracker({
      projectId,
      task,
      store: performanceStore,
      qualityFloor: runtimeOptions.ensembleMinQualityScore,
    });
    let ensemble: AiTextEnsembleResult | undefined;
    let performanceObservationCount = 0;
    let performanceError: string | undefined;

    const generator: AiWritingGenerator = async (providerRequest): Promise<AiGenerationResult> => {
      try {
        ensemble = await runAiTextEnsemble({
          system: providerRequest.system,
          user: providerRequest.user,
          temperature: providerRequest.temperature,
          maxOutputTokens: providerRequest.maxOutputTokens,
          sourceText: extractExistingScene(providerRequest.user),
          projectId,
          title: `${task} ensemble candidate`,
        }, {
          generate: performance.generate,
          options: runtimeOptions,
        });
      } finally {
        try {
          performanceObservationCount = (await performance.flush()).length;
        } catch (error) {
          performanceError = errorText(error);
        }
      }
      if (!ensemble) throw new Error("Multi-model ensemble ended before producing execution metadata.");
      if (!ensemble.accepted) throw new Error(`Multi-model anti-drift gate blocked the candidate. ${ensemble.blockedReasons.join(" ")}`);
      const primary = ensemble.synthesis
        ? { provider: ensemble.synthesis.provider, model: ensemble.synthesis.model }
        : { provider: ensemble.workers[0].actualProvider, model: ensemble.workers[0].actualModel };
      return { provider: primary.provider, model: primary.model, text: ensemble.finalText };
    };

    const coordinator = new AiWritingCoordinator(proposalStore, generator);
    const studio = new AiWritingStudioService(store, coordinator);
    const generated = await studio.generateWithProjectContext({
      projectId,
      bookId,
      chapterId,
      sceneId,
      task,
      instruction,
      proposalId,
      ...(input.sceneCardSha256 ? { sceneCardSha256: required(input.sceneCardSha256, "Scene Card SHA-256") } : {}),
      ...(input.context && typeof input.context === "object" && !Array.isArray(input.context) ? { context: input.context as never } : {}),
    });
    if (!ensemble) throw new Error("Multi-model ensemble completed without execution metadata.");
    json(res, 201, {
      proposal: generated.proposal,
      ensemble,
      contextBudget: generated.contextBudget,
      voiceDrift: generated.voiceDrift ?? null,
      characterContinuity: generated.characterContinuity,
      performanceEvidence: {
        recorded: performanceError === undefined,
        observationCount: performanceObservationCount,
        ensembleId: performance.ensembleId,
        ...(performanceError ? { error: performanceError } : {}),
      },
      authorControl: "Pending proposal only. Author review and separate Apply remain required.",
    });
    return true;
  };
}

function extractExistingScene(user: string): string | undefined {
  const startMarker = "EXISTING SCENE:\n";
  const endMarker = "\n\nGOVERNED PROJECT CONTEXT:";
  const start = user.indexOf(startMarker);
  if (start < 0) return undefined;
  const from = start + startMarker.length;
  const end = user.indexOf(endMarker, from);
  const value = user.slice(from, end < 0 ? undefined : end).trim();
  return value || undefined;
}
function writingTask(value: unknown): AiWritingTask {
  const task = String(value ?? "").trim() as AiWritingTask;
  if (!WRITING_TASKS.includes(task)) throw new Error("Unsupported ensemble writing task.");
  return task;
}
function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const result = value.trim();
  if (result.length > 200_000) throw new Error(`${label} is too long.`);
  return result;
}
function optional(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return required(value, "Optional value");
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += String(chunk);
    if (raw.length > 2 * 1024 * 1024) throw new Error("Ensemble writing request exceeds 2 MiB.");
  }
  if (!raw.trim()) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ensemble writing JSON object required.");
  return value as Record<string, unknown>;
}
function json(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(JSON.stringify(value));
}
function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
