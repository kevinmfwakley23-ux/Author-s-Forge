import { AiWritingService, type AiWritingRequest, type AiWritingResult } from "./ai-writing";
import type { AiProposal, AiProposalStore, ProposalReviewDecision } from "./ai-proposal-store";
import { FileAiProposalStore } from "../infrastructure/file-ai-proposal-store";
import { generateText } from "../infrastructure/ai-provider";

/**
 * Application boundary for Studio writing assistance. It combines the real
 * configured provider boundary with the durable author-controlled proposal
 * ledger. Generation never mutates manuscript state; review is the only
 * transition exposed here and it is author-only by policy.
 */
export class AiWritingCoordinator {
  constructor(private readonly durableStore: FileAiProposalStore) {}

  async generate(request: AiWritingRequest): Promise<AiWritingResult> {
    const proposals = await this.durableStore.load();
    const service = new AiWritingService({
      generate: async (providerRequest) => {
        const result = await generateText({
          system: "You are Author's Forge's writing engine. Produce candidate material only. Preserve supplied canon and author intent. Never present generated material as authoritative canon.",
          user: [
            `TASK: ${providerRequest.task}`,
            `AUTHOR INSTRUCTION:\n${providerRequest.instruction}`,
            `EXISTING SCENE:\n${providerRequest.existingContent}`,
            `GOVERNED PROJECT CONTEXT:\n${providerRequest.assembledContext}`,
          ].join("\n\n"),
          temperature: 0.7,
          maxOutputTokens: 5000,
        });
        return result.text;
      },
    }, proposals);
    const result = await service.generate(request);
    await this.durableStore.save();
    return result;
  }

  async review(proposalId: string, decision: "accepted" | "rejected", note?: string, now?: string): Promise<ProposalReviewDecision> {
    const proposals = await this.durableStore.load();
    const result = proposals.review(proposalId, decision, "author", note, now);
    await this.durableStore.save();
    return result;
  }

  async get(proposalId: string): Promise<AiProposal | undefined> {
    return (await this.durableStore.load()).get(proposalId);
  }

  async list(projectId?: string): Promise<AiProposal[]> {
    return (await this.durableStore.load()).list(projectId);
  }

  get ledger(): AiProposalStore { return this.durableStore.ledger; }
}
