import { advanceWorkflow, type WorkflowAdvanceRequest, type WorkflowAdvanceResult } from "./workflow-advance";
import { withProjectWorkflowStage, type ProjectState } from "../domain/project";
import type { ForgeWorkflowStage, WorkflowGateCheck } from "../domain/workflow-gate";

export interface ProjectWorkflowAdvanceRequest {
  readonly project: ProjectState;
  readonly bookId: string;
  readonly checks: Readonly<Partial<Record<ForgeWorkflowStage, readonly WorkflowGateCheck[]>>>;
  readonly requestedStage?: ForgeWorkflowStage;
  readonly authorApproved?: boolean;
  readonly now?: string;
}

export interface ProjectWorkflowAdvanceResult {
  readonly project: ProjectState;
  readonly workflow: WorkflowAdvanceResult;
}

/** Applies the workflow gate to durable project state without bypassing author approval. */
export function advanceProjectWorkflow(input: ProjectWorkflowAdvanceRequest): ProjectWorkflowAdvanceResult {
  const fromStage = input.project.workflowStage ?? "concept";
  const request: WorkflowAdvanceRequest = {
    id: `workflow-${input.project.metadata.id}-${input.bookId}-${fromStage}`,
    projectId: input.project.metadata.id,
    bookId: input.bookId,
    currentStage: fromStage,
    requestedStage: input.requestedStage,
    checks: input.checks,
    now: input.now,
  };
  const workflow = advanceWorkflow(request);
  if (workflow.decision === "blocked") return { project: input.project, workflow };
  if (input.authorApproved !== true) {
    return {
      project: input.project,
      workflow: { ...workflow, decision: "blocked", toStage: workflow.fromStage, blockers: ["AUTHOR_APPROVAL_REQUIRED"] },
    };
  }
  return { project: withProjectWorkflowStage(input.project, workflow.toStage, input.now), workflow };
}
