import { AiEditingProposalService, type AiEditingProposalRequest } from "./ai-editing-proposals";
import type { AiProposal, AiProposalStore } from "./ai-proposal-store";
import type { AiWritingGenerator } from "./ai-writing-coordinator";

/**
 * Studio-facing boundary for editorial rewrite proposals.
 *
 * The service deliberately does not mutate manuscript state. It converts a
 * validated editorial finding into the same durable, author-reviewed proposal
 * ledger used by the Writing Desk.
 */
export class AiEditingStudioService {
  constructor(private readonly proposals: AiProposalStore, private readonly generator: AiWritingGenerator) {}

  async propose(request: AiEditingProposalRequest): Promise<AiProposal> {
    const service = new AiEditingProposalService(this.proposals, this.generator);
    const proposal = await service.proposeRewrite(request);
    await this.proposals.save();
    return proposal;
  }
}
