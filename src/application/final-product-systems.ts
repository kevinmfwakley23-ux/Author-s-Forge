import { advanceCapabilityGap, createBookGenome, createCapabilityGap, createCreativeProvenance, createFinalProductAudit, createVoiceCommand, defaultAccessibilityProfile, defaultOwnershipPolicy, identifyGenomeImpact, type AccessibilityProfile, type BookGenome, type CapabilityGap, type CreativeProvenance, type FinalDeliveryCheck, type FinalProductAudit, type VoiceCommand, type GenomeImpact, type OwnershipPolicy } from "../domain/final-product-systems";

export class CapabilityEscalationService {
  public request(input: Parameters<typeof createCapabilityGap>[0]): CapabilityGap { return createCapabilityGap(input); }
  public advance(gap:CapabilityGap,status:Parameters<typeof advanceCapabilityGap>[1],note:string,now?:string):CapabilityGap { return advanceCapabilityGap(gap,status,note,now); }
}

export class GovernanceService {
  public ownershipPolicy():OwnershipPolicy { return defaultOwnershipPolicy(); }
  public accessibilityProfile(overrides?:Partial<AccessibilityProfile>):AccessibilityProfile { return {...defaultAccessibilityProfile(),...(overrides??{})}; }
  public provenance(input:Parameters<typeof createCreativeProvenance>[0]):CreativeProvenance { if((input.kind==="real-person"||input.kind==="user-uploaded")&&input.consentStatus!=="granted") throw new Error("Consent must be granted before processing this creative source."); return createCreativeProvenance(input); }
  public voiceCommand(input:Parameters<typeof createVoiceCommand>[0]):VoiceCommand { return createVoiceCommand(input); }
}

export class BookGenomeService {
  public create(input:Parameters<typeof createBookGenome>[0]):BookGenome { return createBookGenome(input); }
  public impact(genome:BookGenome,changedNodeId:string):GenomeImpact { return identifyGenomeImpact(genome,changedNodeId); }
}

export class FinalProductAuditService {
  public run(input:{id:string;projectId:string;checks:readonly FinalDeliveryCheck[];generatedAt?:string}):FinalProductAudit { return createFinalProductAudit(input); }
}
