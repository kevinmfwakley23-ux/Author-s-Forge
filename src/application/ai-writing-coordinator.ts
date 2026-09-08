import { AiWritingService, type AiWritingCandidateAssessor, type AiWritingRequest, type AiWritingResult } from "./ai-writing";
import type { AiProposal, AiProposalStore, ProposalReviewDecision } from "./ai-proposal-store";
import { FileAiProposalStore } from "../infrastructure/file-ai-proposal-store";
import type { AiGenerationResult } from "../infrastructure/ai-provider";
import { generateMainStudioText } from "../infrastructure/main-studio-ai-runtime";
import { aiMissionRoutingGenerationFields } from "./ai-mission-routing";
import { createHash } from "node:crypto";

export type AiWritingGenerator = (request: {
  system: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
  preferProvider?: string;
  preferModel?: string;
}) => Promise<AiGenerationResult>;

export interface AiWritingExecutionEvidence {
  readonly requestedProvider?: string;
  readonly requestedModel?: string;
  readonly provider: AiGenerationResult["provider"];
  readonly model: string;
  readonly requestId?: string;
  readonly cacheHit?: boolean;
  readonly fallbackUsed: boolean;
  readonly attempts: readonly {
    readonly provider: AiGenerationResult["provider"];
    readonly model?: string;
    readonly success: boolean;
    readonly latencyMs: number;
    readonly error?: string;
  }[];
  readonly routing?: AiGenerationResult["routing"];
}

export type CoordinatedAiWritingResult = AiWritingResult & {
  readonly execution: AiWritingExecutionEvidence;
};

/** Durable application boundary for real Studio writing assistance. */
export class AiWritingCoordinator {
  private readonly generator: AiWritingGenerator;

  constructor(private readonly durableStore: FileAiProposalStore, generator: AiWritingGenerator = generateMainStudioText) {
    this.generator = generator;
  }

  async generate(
    request: AiWritingRequest,
    assessCandidate?: AiWritingCandidateAssessor,
  ): Promise<CoordinatedAiWritingResult> {
    const { routingPreference, ...durableRequest } = request;
    const proposals = await this.durableStore.load();
    let execution: AiWritingExecutionEvidence | undefined;
    const service = new AiWritingService({
      generate: async (providerRequest) => {
        const result = await this.generator({
          system: "You are Author's Forge's writing engine. Produce candidate material only. Preserve supplied canon and author intent. Never present generated material as authoritative canon.",
          user: [
            `TASK: ${providerRequest.task}`,
            `AUTHOR INSTRUCTION:\n${providerRequest.instruction}`,
            `EXISTING SCENE:\n${providerRequest.existingContent}`,
            `GOVERNED PROJECT CONTEXT:\n${providerRequest.assembledContext}`,
          ].join("\n\n"),
          temperature: 0.7,
          maxOutputTokens: 5000,
          ...aiMissionRoutingGenerationFields(routingPreference),
        });
        const attempts = (result.attempts ?? []).map((attempt) => ({
          provider: attempt.provider,
          ...(attempt.model ? { model: attempt.model } : {}),
          success: attempt.success,
          latencyMs: attempt.latencyMs,
          ...(attempt.error ? { error: attempt.error } : {}),
        }));
        const requestedProvider = routingPreference?.preferProvider;
        const requestedModel = routingPreference?.preferModel;
        execution = {
          ...(requestedProvider ? { requestedProvider } : {}),
          ...(requestedModel ? { requestedModel } : {}),
          provider: result.provider,
          model: result.model,
          ...(result.requestId ? { requestId: result.requestId } : {}),
          ...(result.cacheHit !== undefined ? { cacheHit: result.cacheHit } : {}),
          fallbackUsed: attempts.some((attempt) => !attempt.success)
            || Boolean(requestedProvider && requestedProvider !== result.provider)
            || Boolean(requestedModel && requestedModel !== result.model),
          attempts,
          ...(result.routing ? { routing: { ...result.routing } } : {}),
        };
        return result.text;
      },
    }, proposals, assessCandidate);
    const result = await service.generate({
      ...durableRequest,
      baseContentSha256: durableRequest.baseContentSha256 ?? sha256(durableRequest.existingContent),
    });
    if (!execution) throw new Error("AI writing provider completed without execution evidence.");
    await this.durableStore.save();
    return { ...result, execution };
  }

  async review(proposalId: string, decision: "accepted" | "rejected", note?: string, now?: string): Promise<ProposalReviewDecision> {
    const proposals = await this.durableStore.load();
    const result = proposals.review(proposalId, decision, "author", note, now);
    await this.durableStore.save();
    return result;
  }

  async get(proposalId: string): Promise<AiProposal | undefined> { return (await this.durableStore.load()).get(proposalId); }
  async list(projectId?: string): Promise<AiProposal[]> { return (await this.durableStore.load()).list(projectId); }
  get ledger(): AiProposalStore { return this.durableStore.ledger; }
}

export function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
