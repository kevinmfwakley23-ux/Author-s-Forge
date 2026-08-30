import {
  FORGE_WORKFLOW_STAGES,
  canAdvanceWorkflow,
  createWorkflowGateReport,
  type ForgeWorkflowStage,
  type WorkflowGateInput,
  type WorkflowGateReport,
} from "../domain/workflow-gate";

export const WORKFLOW_ADVANCE_FORMAT_VERSION = 1 as const;
export type WorkflowAdvanceDecision = "advanced" | "blocked";

export interface WorkflowAdvanceRequest extends WorkflowGateInput {
  readonly requestedStage?: ForgeWorkflowStage;
}

export interface WorkflowAdvanceResult {
  readonly formatVersion: typeof WORKFLOW_ADVANCE_FORMAT_VERSION;
  readonly decision: WorkflowAdvanceDecision;
  readonly fromStage: ForgeWorkflowStage;
  readonly toStage: ForgeWorkflowStage;
  readonly report: WorkflowGateReport;
  readonly blockers: readonly string[];
}

export function advanceWorkflow(request: WorkflowAdvanceRequest): WorkflowAdvanceResult {
  const report = createWorkflowGateReport(request);
  const currentIndex = FORGE_WORKFLOW_STAGES.indexOf(request.currentStage);
  const nextStage = currentIndex < FORGE_WORKFLOW_STAGES.length - 1
    ? FORGE_WORKFLOW_STAGES[currentIndex + 1]
    : request.currentStage;
  const requestedStage = request.requestedStage ?? nextStage;
  const sequential = requestedStage === nextStage;
  const allowed = sequential && canAdvanceWorkflow(report, request.currentStage);
  const currentGate = report.stages.find((stage) => stage.stage === request.currentStage);
  const blockers = currentGate?.checks.filter((check) => !check.passed).map((check) => check.id) ?? [];

  return {
    formatVersion: WORKFLOW_ADVANCE_FORMAT_VERSION,
    decision: allowed ? "advanced" : "blocked",
    fromStage: request.currentStage,
    toStage: allowed ? requestedStage : request.currentStage,
    report,
    blockers: allowed ? [] : [
      ...(sequential ? [] : ["WORKFLOW_STAGE_ORDER_INVALID"]),
      ...blockers,
    ],
  };
}
