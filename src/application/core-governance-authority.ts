export type ForgeActor = "author" | "ai" | "system";
export type ForgeMutationClass = "canon" | "manuscript" | "character" | "voice" | "research" | "production" | "operational";
export type ForgeMutationIntent = "propose" | "apply" | "lock" | "override";

export interface ForgeMutationRequest {
  readonly projectId: string;
  readonly targetId: string;
  readonly actor: ForgeActor;
  readonly mutationClass: ForgeMutationClass;
  readonly intent: ForgeMutationIntent;
  readonly authorApproved?: boolean;
  readonly reason?: string;
}

export interface ForgeMutationDecision {
  readonly allowed: boolean;
  readonly requiresAuthorApproval: boolean;
  readonly reason: string;
}

/** Shared author-control boundary for state-changing actions across Forge offices. */
export class CoreGovernanceAuthority {
  evaluate(request: ForgeMutationRequest): ForgeMutationDecision {
    assertRequired(request.projectId, "Project id");
    assertRequired(request.targetId, "Target id");

    if (request.actor === "author") {
      return { allowed: true, requiresAuthorApproval: false, reason: "Author-directed mutation." };
    }

    if (request.actor === "ai") {
      if (request.intent === "propose") {
        return { allowed: true, requiresAuthorApproval: false, reason: "AI proposal does not mutate authoritative author state." };
      }
      if (request.authorApproved === true) {
        return { allowed: true, requiresAuthorApproval: false, reason: "AI-assisted mutation explicitly approved by the author." };
      }
      return { allowed: false, requiresAuthorApproval: true, reason: "AI cannot apply, lock, or override author-owned state without explicit author approval." };
    }

    if (request.actor === "system") {
      if (request.mutationClass === "operational" && request.intent === "apply") {
        return { allowed: true, requiresAuthorApproval: false, reason: "System operational mutation is non-creative infrastructure state." };
      }
      return { allowed: false, requiresAuthorApproval: request.mutationClass !== "operational", reason: "System actors cannot mutate author-owned creative state." };
    }

    return { allowed: false, requiresAuthorApproval: true, reason: "Unknown actor cannot mutate project state." };
  }

  assertAllowed(request: ForgeMutationRequest): void {
    const decision = this.evaluate(request);
    if (!decision.allowed) throw new Error(decision.reason);
  }
}

function assertRequired(value: string, label: string): void {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
}
