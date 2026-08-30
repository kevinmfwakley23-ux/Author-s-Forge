import {
  FORGE_WORKFLOW_STAGES,
  canAdvanceWorkflow,
  createWorkflowGateReport,
  type ForgeWorkflowStage,
  type WorkflowGateCheck,
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

function validateChecks(checks: WorkflowAdvanceRequest["checks"]): void {
  for (const [stage, stageChecks] of Object.entries(checks)) {
    if (!(FORGE_WORKFLOW_STAGES as readonly string[]).includes(stage)) throw new Error(`Unsupported workflow stage: ${stage}`);
    if (!Array.isArray(stageChecks)) throw new Error(`Workflow checks for ${stage} must be an array.`);
    const ids = new Set<string>();
    for (const check of stageChecks as readonly WorkflowGateCheck[]) {
      if (!check || typeof check !== "object") throw new Error(`Workflow check for ${stage} must be an object.`);
      if (typeof check.id !== "string" || !check.id.trim()) throw new Error(`Workflow check id is required for ${stage}.`);
      if (ids.has(check.id)) throw new Error(`Duplicate workflow check id "${check.id}" in ${stage}.`);
      ids.add(check.id);
      if (typeof check.label !== "string" || !check.label.trim()) throw new Error(`Workflow check label is required for "${check.id}".`);
      if (typeof check.passed !== "boolean") throw new Error(`Workflow check "${check.id}" must declare passed as a boolean.`);
      if (check.remediation !== undefined && typeof check.remediation !== "string") throw new Error(`Workflow check remediation must be a string for "${check.id}".`);
    }
  }
}

export function advanceWorkflow(request: WorkflowAdvanceRequest): WorkflowAdvanceResult {
  validateChecks(request.checks);
  const report = createWorkflowGateReport(request);
  const currentIndex = FORGE_WORKFLOW_STAGES.indexOf(request.currentStage);
  const hasNextStage = currentIndex < FORGE_WORKFLOW_STAGES.length - 1;
  const nextStage = hasNextStage ? FORGE_WORKFLOW_STAGES[currentIndex + 1] : request.currentStage;
  const requestedStage = request.requestedStage ?? nextStage;
  const sequential = hasNextStage && requestedStage === nextStage;
  const allowed = sequential && canAdvanceWorkflow(report, request.currentStage);
  const currentGate = report.stages.find((stage) => stage.stage === request.currentStage);
  const blockers = currentGate?.checks.filter((check) => !check.passed).map((check) => check.id) ?? [];
  const stageBlocker = hasNextStage ? [] : ["WORKFLOW_FINAL_STAGE_REACHED"];

  return {
    formatVersion: WORKFLOW_ADVANCE_FORMAT_VERSION,
    decision: allowed ? "advanced" : "blocked",
    fromStage: request.currentStage,
    toStage: allowed ? requestedStage : request.currentStage,
    report,
    blockers: allowed ? [] : [
      ...(sequential ? [] : ["WORKFLOW_STAGE_ORDER_INVALID"]),
      ...stageBlocker,
      ...blockers,
    ],
  };
}
