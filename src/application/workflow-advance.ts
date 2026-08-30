import {
  canAdvanceWorkflow,
  createWorkflowGateReport,
  type ForgeWorkflowStage,
  type WorkflowGateInput,
  type WorkflowGateReport,
} from "../domain/workflow-gate";

export const WORKFLOW_ADVANCE_FORMAT_VERSION = 1;

export type WorkflowAdvanceDecision =
  | "advanced"
  | "blocked";

export interface WorkflowAdvanceRequest extends WorkflowGateInput {
  readonly currentStage: ForgeWorkflowStage;
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

const stageIndex = (stage: ForgeWorkflowStage): number => {
  const stages: readonly ForgeWorkflowStage[] = [
    "concept",
    "architecture",
    "canon",
    "manuscript",
    "editing",
    "visuals",
    "production",
    "positioning",
    "marketing",
    "release",
  ];
  return stages.indexOf(stage);
};

export function advanceWorkflow(request: WorkflowAdvanceRequest): WorkflowAdvanceResult {
  const report = createWorkflowGateReport(request);
  const requestedStage = request.requestedStage ??
    (stageIndex(request.currentStage) < stageIndex("release")
      ? (["concept", "architecture", "canon", "manuscript", "editing", "visuals", "production", "positioning", "marketing", "release"] as const)[stageIndex(request.currentStage) + 1]
      : request.currentStage);

  const sequential = stageIndex(requestedStage) === stageIndex(request.currentStage) + 1;
  const allowed = sequential && canAdvanceWorkflow(report);

  return {
    formatVersion: WORKFLOW_ADVANCE_FORMAT_VERSION,
    decision: allowed ? "advanced" : "blocked",
    fromStage: request.currentStage,
    toStage: allowed ? requestedStage : request.currentStage,
    report,
    blockers: allowed ? [] : [
      ...(sequential ? [] : ["WORKFLOW_STAGE_ORDER_INVALID"]),
      ...report.checks.filter((check) => !check.passed).map((check) => check.id),
    ],
  };
}
