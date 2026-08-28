import { advanceCapabilityGap, createBookGenome, createCapabilityGap, createCreativeProvenance, createVoiceCommand, type AccessibilityProfile, type BookGenome, type CapabilityGap, type CreativeProvenance, type FinalDeliveryCheck, type FinalProductAudit, type VoiceCommand, type GenomeImpact, type OwnershipPolicy } from "../domain/final-product-systems";
export declare class CapabilityEscalationService {
    request(input: Parameters<typeof createCapabilityGap>[0]): CapabilityGap;
    advance(gap: CapabilityGap, status: Parameters<typeof advanceCapabilityGap>[1], note: string, now?: string): CapabilityGap;
}
export declare class GovernanceService {
    ownershipPolicy(): OwnershipPolicy;
    accessibilityProfile(overrides?: Partial<AccessibilityProfile>): AccessibilityProfile;
    provenance(input: Parameters<typeof createCreativeProvenance>[0]): CreativeProvenance;
    voiceCommand(input: Parameters<typeof createVoiceCommand>[0]): VoiceCommand;
}
export declare class BookGenomeService {
    create(input: Parameters<typeof createBookGenome>[0]): BookGenome;
    impact(genome: BookGenome, changedNodeId: string): GenomeImpact;
}
export declare class FinalProductAuditService {
    run(input: {
        id: string;
        projectId: string;
        checks: readonly FinalDeliveryCheck[];
        generatedAt?: string;
    }): FinalProductAudit;
}
