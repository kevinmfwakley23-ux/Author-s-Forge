import { AiEditingProposalService, type AiEditingProposalRequest } from "./ai-editing-proposals";
import type { AiProposal } from "./ai-proposal-store";
import type { AiWritingGenerator } from "./ai-writing-coordinator";
import type { AiWritingCandidateAssessor } from "./ai-writing";
import { FileAiProposalStore } from "../infrastructure/file-ai-proposal-store";

/**
 * Studio-facing boundary for editorial rewrite proposals.
 *
 * The service deliberately does not mutate manuscript state. It converts a
 * validated editorial finding into the durable, author-reviewed proposal
 * ledger used by the Writing Desk.
 */
export class AiEditingStudioService {
  constructor(private readonly proposals: FileAiProposalStore, private readonly generator: AiWritingGenerator) {}

  async propose(request: AiEditingProposalRequest, assessCandidate?: AiWritingCandidateAssessor): Promise<AiProposal> {
    const ledger = await this.proposals.load();
    const service = new AiEditingProposalService(ledger, this.generator, assessCandidate);
    const proposal = await service.proposeRewrite(request);
    await this.proposals.save();
    return proposal;
  }
}
