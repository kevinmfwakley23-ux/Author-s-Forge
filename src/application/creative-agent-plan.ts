import { createAiCollaborationPolicy, type AiCollaborationMode } from "../domain/ai-collaboration";
import { creativeToolById, type CreativeToolDescriptor, type CreativeToolScope } from "./creative-tool-registry";

export const CREATIVE_AGENT_PLAN_FORMAT_VERSION = 1 as const;

export interface CreativeAgentPlanScope {
  readonly project: true;
  readonly book?: boolean;
  readonly chapter?: boolean;
  readonly scene?: boolean;
  readonly sceneHasContent?: boolean;
}

export interface CreativeAgentPlanInput {
  readonly goal: string;
  readonly mode: AiCollaborationMode;
  readonly scope: CreativeAgentPlanScope;
}

export interface CreativeAgentPlanStep {
  readonly sequence: number;
  readonly id: string;
  readonly toolId: string;
  readonly title: string;
  readonly reason: string;
  readonly approvalClass: CreativeToolDescriptor["approvalClass"];
  readonly providerRequirement: CreativeToolDescriptor["providerRequirement"];
  readonly stateEffect: CreativeToolDescriptor["stateEffect"];
  readonly requiredScope: readonly CreativeToolScope[];
  readonly blockedReason?: string;
  readonly eligibleForApprovedRunGroup: boolean;
}

export interface CreativeAgentPlan {
  readonly formatVersion: typeof CREATIVE_AGENT_PLAN_FORMAT_VERSION;
  readonly goal: string;
  readonly mode: AiCollaborationMode;
  readonly policy: {
    readonly authorApprovalRequiredForMajorDecisions: true;
    readonly bulkExecutionEligible: boolean;
    readonly directCanonMutationAllowed: false;
    readonly directManuscriptMutationAllowed: false;
    readonly writingMustUseProposalBoundary: true;
  };
  readonly steps: readonly CreativeAgentPlanStep[];
}

export function compileCreativeAgentPlan(input: CreativeAgentPlanInput): CreativeAgentPlan {
  const goal = text(input.goal, "Creative agent goal");
  const lower = goal.toLowerCase();
  const policy = createAiCollaborationPolicy(input.mode);
  const requested = new Set<string>();

  if (hasAny(lower, ["research", "source", "fact", "verify", "market", "niche", "history", "setting", "real world"])) requested.add("research.live");
  if (hasAny(lower, ["outline", "architecture", "plot", "story structure", "chapter plan", "plan the book", "premise"])) requested.add("architecture.generate");
  const wantsWriting = hasAny(lower, [
    "write", "draft", "continue", "prose", "manuscript", "rewrite", "compose",
    "write the scene", "write this scene", "write a scene", "draft the scene", "draft this scene",
    "write the chapter", "write this chapter", "write a chapter", "draft the chapter", "draft this chapter",
  ]);
  const wantsEditing = hasAny(lower, ["edit", "revise", "revision", "polish", "critique", "continuity", "copyedit", "proofread", "proofreading"]);
  if (wantsWriting) {
    requested.add("project.context");
    requested.add("writing.propose");
  }
  if (wantsEditing || input.mode === "editor") requested.add("editing.analyze");
  if (hasAny(lower, ["export", "pdf", "epub", "docx", "production", "print", "review copy", "publish"])) requested.add("production.export");

  if (!requested.size) {
    if (input.mode === "editor") requested.add("editing.analyze");
    else {
      requested.add("project.context");
      requested.add("writing.propose");
    }
  }
  requested.add("memory.record-working");

  const orderedIds = [
    "research.live",
    "architecture.generate",
    "project.context",
    "writing.propose",
    "editing.analyze",
    "production.export",
    "memory.record-working",
  ].filter((id) => requested.has(id));

  const steps = orderedIds.map((toolId, index) => {
    const tool = creativeToolById(toolId);
    let blockedReason = missingScopeReason(tool, input.scope);
    if (!blockedReason && toolId === "writing.propose" && !policy.aiMayDraft) {
      blockedReason = `Collaboration mode "${policy.mode}" is configured not to draft new prose. Change mode before planning an AI writing proposal.`;
    }
    if (!blockedReason && toolId === "editing.analyze" && input.scope.scene && !input.scope.sceneHasContent) {
      blockedReason = "The selected scene has no manuscript text to analyze.";
    }
    const eligibleForApprovedRunGroup = !blockedReason && policy.aiMayExecuteBulkWork && tool.approvalClass === "read-only" && tool.stateEffect === "none";
    return Object.freeze({
      sequence: index + 1,
      id: `step-${index + 1}-${tool.id}`,
      toolId: tool.id,
      title: tool.title,
      reason: reasonFor(tool.id, goal),
      approvalClass: tool.approvalClass,
      providerRequirement: tool.providerRequirement,
      stateEffect: tool.stateEffect,
      requiredScope: tool.requiredScope,
      ...(blockedReason ? { blockedReason } : {}),
      eligibleForApprovedRunGroup,
    });
  });

  return Object.freeze({
    formatVersion: CREATIVE_AGENT_PLAN_FORMAT_VERSION,
    goal,
    mode: policy.mode,
    policy: Object.freeze({
      authorApprovalRequiredForMajorDecisions: true as const,
      bulkExecutionEligible: policy.aiMayExecuteBulkWork,
      directCanonMutationAllowed: false as const,
      directManuscriptMutationAllowed: false as const,
      writingMustUseProposalBoundary: true as const,
    }),
    steps: Object.freeze(steps),
  });
}

function missingScopeReason(tool: CreativeToolDescriptor, scope: CreativeAgentPlanScope): string | undefined {
  const missing = tool.requiredScope.filter((required) => required !== "project" && !scope[required]);
  if (!missing.length) return undefined;
  return `Tool "${tool.id}" requires ${missing.join(", ")} scope before it can run.`;
}

function reasonFor(toolId: string, goal: string): string {
  switch (toolId) {
    case "research.live": return `Gather source-backed working evidence relevant to: ${goal}`;
    case "architecture.generate": return `Generate a reviewable architecture candidate relevant to: ${goal}`;
    case "project.context": return "Ground later generation in the current Project Brain and author-controlled project truth.";
    case "writing.propose": return `Create a durable, separately reviewable writing proposal for: ${goal}`;
    case "editing.analyze": return `Analyze existing manuscript craft without silently rewriting it: ${goal}`;
    case "production.export": return `Render a real review/production artifact requested by the author: ${goal}`;
    case "memory.record-working": return "Preserve author-approved execution evidence as working memory without promoting it to canon.";
    default: return goal;
  }
}

function hasAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function text(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const normalized = value.trim();
  if (normalized.length > 10_000) throw new Error(`${label} exceeds 10,000 characters.`);
  return normalized;
}
