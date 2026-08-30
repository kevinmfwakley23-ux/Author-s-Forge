export const WORKFLOW_GATE_FORMAT_VERSION = 1 as const;
export const FORGE_WORKFLOW_STAGES = ["concept","architecture","canon","manuscript","editing","visuals","production","positioning","marketing","release"] as const;
export type ForgeWorkflowStage = typeof FORGE_WORKFLOW_STAGES[number];
export type WorkflowGateStatus = "blocked" | "ready";
export interface WorkflowGateCheck { readonly id:string; readonly label:string; readonly passed:boolean; readonly remediation?:string; }
export interface WorkflowStageGate { readonly stage:ForgeWorkflowStage; readonly status:WorkflowGateStatus; readonly checks:readonly WorkflowGateCheck[]; readonly completedAt?:string; }
export interface WorkflowGateReport { readonly formatVersion:typeof WORKFLOW_GATE_FORMAT_VERSION; readonly id:string; readonly projectId:string; readonly bookId:string; readonly generatedAt:string; readonly currentStage:ForgeWorkflowStage; readonly stages:readonly WorkflowStageGate[]; }
export interface WorkflowGateInput { readonly id:string; readonly projectId:string; readonly bookId:string; readonly currentStage:ForgeWorkflowStage; readonly checks:Readonly<Partial<Record<ForgeWorkflowStage,readonly WorkflowGateCheck[]>>>; readonly now?:string; }
function required(value:string,label:string):void { if(!value.trim()) throw new Error(`${label} is required.`); }
function validateStage(stage:ForgeWorkflowStage):void { if(!FORGE_WORKFLOW_STAGES.includes(stage)) throw new Error(`Unsupported workflow stage: ${stage}`); }
export function createWorkflowGateReport(input:WorkflowGateInput):WorkflowGateReport {
  required(input.id,"Workflow gate id"); required(input.projectId,"Project id"); required(input.bookId,"Book id"); validateStage(input.currentStage);
  const now=input.now??new Date().toISOString();
  const stages=FORGE_WORKFLOW_STAGES.map((stage)=>{ const checks=[...(input.checks[stage]??[])]; const passed=checks.every((check:WorkflowGateCheck)=>check.passed); return {stage,status:passed?"ready":"blocked",checks:structuredClone(checks),...(passed?{completedAt:now}:{})} as WorkflowStageGate; });
  return {formatVersion:WORKFLOW_GATE_FORMAT_VERSION,id:input.id,projectId:input.projectId,bookId:input.bookId,generatedAt:now,currentStage:input.currentStage,stages};
}
export function canAdvanceWorkflow(report:WorkflowGateReport,from:ForgeWorkflowStage):boolean { validateStage(from); const index=FORGE_WORKFLOW_STAGES.indexOf(from); return index<FORGE_WORKFLOW_STAGES.length-1 && report.stages[index].status==="ready"; }
export function validateWorkflowGateReport(report:WorkflowGateReport):WorkflowGateReport {
  if(report.formatVersion!==WORKFLOW_GATE_FORMAT_VERSION) throw new Error("Unsupported workflow gate format version.");
  required(report.id,"Workflow gate id"); required(report.projectId,"Project id"); required(report.bookId,"Book id"); validateStage(report.currentStage);
  if(!Array.isArray(report.stages)||report.stages.length!==FORGE_WORKFLOW_STAGES.length) throw new Error("Workflow gate must contain exactly one gate for every Forge workflow stage.");
  report.stages.forEach((stage,index)=>{ if(stage.stage!==FORGE_WORKFLOW_STAGES[index]) throw new Error("Workflow stages are out of canonical order."); const expected=stage.checks.every((check:WorkflowGateCheck)=>check.passed)?"ready":"blocked"; if(stage.status!==expected) throw new Error(`Workflow gate status is inconsistent for ${stage.stage}.`); });
  return structuredClone(report);
}
