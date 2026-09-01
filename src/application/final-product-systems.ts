import {
  advanceCapabilityGap,
  createBookGenome,
  createCapabilityGap,
  createCreativeProvenance,
  createFinalProductAudit,
  createVoiceCommand,
  defaultAccessibilityProfile,
  defaultOwnershipPolicy,
  identifyGenomeImpact,
  type AccessibilityProfile,
  type BookGenome,
  type CapabilityGap,
  type CreativeProvenance,
  type FinalDeliveryCheck,
  type FinalProductAudit,
  type VoiceCommand,
  type GenomeImpact,
  type OwnershipPolicy,
} from "../domain/final-product-systems";
import type { DeliveryAuditCategory, DeliveryAuditCheck, DeliveryAuditReport } from "../domain/delivery-audit";
import type { ProjectState } from "../domain/project";
import { DeliveryAuditService } from "./delivery-audit";

export class CapabilityEscalationService {
  public request(input: Parameters<typeof createCapabilityGap>[0]): CapabilityGap {
    return createCapabilityGap(input);
  }

  public advance(
    gap: CapabilityGap,
    status: Parameters<typeof advanceCapabilityGap>[1],
    note: string,
    now?: string,
  ): CapabilityGap {
    return advanceCapabilityGap(gap, status, note, now);
  }
}

export class GovernanceService {
  public ownershipPolicy(): OwnershipPolicy {
    return defaultOwnershipPolicy();
  }

  public accessibilityProfile(overrides?: Partial<AccessibilityProfile>): AccessibilityProfile {
    return { ...defaultAccessibilityProfile(), ...(overrides ?? {}) };
  }

  public provenance(input: Parameters<typeof createCreativeProvenance>[0]): CreativeProvenance {
    if ((input.kind === "real-person" || input.kind === "user-uploaded") && input.consentStatus !== "granted") {
      throw new Error("Consent must be granted before processing this creative source.");
    }
    return createCreativeProvenance(input);
  }

  public voiceCommand(input: Parameters<typeof createVoiceCommand>[0]): VoiceCommand {
    return createVoiceCommand(input);
  }
}

export class BookGenomeService {
  public create(input: Parameters<typeof createBookGenome>[0]): BookGenome {
    return createBookGenome(input);
  }

  public impact(genome: BookGenome, changedNodeId: string): GenomeImpact {
    return identifyGenomeImpact(genome, changedNodeId);
  }
}

export interface RecordedFinalProductAudit {
  readonly project: ProjectState;
  readonly finalAudit: FinalProductAudit;
  readonly deliveryAudit: DeliveryAuditReport;
}

const FINAL_TO_DELIVERY_CATEGORY: Readonly<Record<FinalDeliveryCheck["category"], DeliveryAuditCategory>> = Object.freeze({
  canon: "canon",
  continuity: "continuity",
  timeline: "timeline",
  characters: "character",
  pov: "pov",
  style: "style",
  grammar: "grammar",
  formatting: "formatting",
  research: "research",
  artwork: "artwork",
  cover: "cover",
  metadata: "metadata",
  publishing: "publishing",
});

export class FinalProductAuditService {
  public run(input: {
    id: string;
    projectId: string;
    checks: readonly FinalDeliveryCheck[];
    generatedAt?: string;
  }): FinalProductAudit {
    return createFinalProductAudit(input);
  }

  public runAndRecord(
    project: ProjectState,
    input: {
      id: string;
      projectId: string;
      checks: readonly FinalDeliveryCheck[];
      generatedAt?: string;
    },
    persistedAt?: string,
  ): RecordedFinalProductAudit {
    if (input.projectId !== project.metadata.id) {
      throw new Error("Final product audit belongs to another project.");
    }

    const finalAudit = this.run(input);
    const checks = finalAudit.checks.map((check): DeliveryAuditCheck => Object.freeze({
      id: `final-product:${finalAudit.id}:${check.category}`,
      category: FINAL_TO_DELIVERY_CATEGORY[check.category],
      passed: check.passed,
      severity: check.blocking ? "critical" : "warning",
      message: check.message,
    }));

    const recorded = new DeliveryAuditService().record(
      project,
      checks,
      finalAudit.generatedAt,
      persistedAt,
    );

    return Object.freeze({
      project: recorded.project,
      finalAudit,
      deliveryAudit: recorded.report,
    });
  }
}
