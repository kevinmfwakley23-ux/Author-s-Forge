import { AiEditingProposalService, type AiEditingProposalRequest } from "./ai-editing-proposals";
import type { AiProposal } from "./ai-proposal-store";
import type { AiWritingGenerator } from "./ai-writing-coordinator";
import type { AiWritingCandidateAssessor } from "./ai-writing";
import { FileAiProposalStore } from "../infrastructure/file-ai-proposal-store";
import { generateText } from "../infrastructure/ai-provider";
import { generateMainStudioText } from "../infrastructure/main-studio-ai-runtime";

/**
 * Studio-facing boundary for editorial rewrite proposals.
 *
 * The service deliberately does not mutate manuscript state. It converts a
 * validated editorial finding into the durable, author-reviewed proposal
 * ledger used by the Writing Desk. Production callers that pass the shared
 * generateText export are normalized onto the main Studio's ForgeCore-bound
 * generator; explicit injected test generators remain untouched.
 */
export class AiEditingStudioService {
  private readonly generator: AiWritingGenerator;

  constructor(private readonly proposals: FileAiProposalStore, generator: AiWritingGenerator = generateMainStudioText) {
    this.generator = generator === generateText ? generateMainStudioText : generator;
  }

  async propose(request: AiEditingProposalRequest, assessCandidate?: AiWritingCandidateAssessor): Promise<AiProposal> {
    const ledger = await this.proposals.load();
    const service = new AiEditingProposalService(ledger, this.generator, assessCandidate);
    const proposal = await service.proposeRewrite(request);
    await this.proposals.save();
    return proposal;
  }
}
