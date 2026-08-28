export declare const FINAL_PRODUCT_FORMAT_VERSION: 1;
export declare const BOOK_GENOME_COMPONENTS: readonly ["premise", "theme", "genre", "voice", "canon", "characters", "relationships", "locations", "timeline", "events", "scenes", "objects", "clues", "reveals", "conflicts", "motivations", "research", "visual-identities", "art", "cover", "metadata", "publishing-state"];
export type BookGenomeComponent = typeof BOOK_GENOME_COMPONENTS[number];
export type CapabilityGapStatus = "requested" | "researching" | "planned" | "building" | "testing" | "verified" | "rejected";
export interface CapabilityGap {
    readonly id: string;
    readonly projectId: string;
    readonly capability: string;
    readonly reason: string;
    readonly requestedAt: string;
    readonly status: CapabilityGapStatus;
    readonly authority: "kings";
    readonly auditTrail: readonly string[];
}
export interface OwnershipPolicy {
    readonly projectIsolation: true;
    readonly encryptedAtRest: boolean;
    readonly explicitPermissions: true;
    readonly exportEnabled: true;
    readonly deleteEnabled: true;
    readonly auditHistory: true;
    readonly silentExternalUploads: false;
    readonly researchConsentRequired: true;
    readonly imageProcessingConsentRequired: true;
    readonly providerTransparency: true;
    readonly localFirst: boolean;
}
export interface AccessibilityProfile {
    readonly keyboard: boolean;
    readonly mouse: boolean;
    readonly touch: boolean;
    readonly voice: boolean;
    readonly screenReader: boolean;
    readonly largeText: boolean;
    readonly highContrast: boolean;
}
export interface VoiceCommand {
    readonly id: string;
    readonly projectId: string;
    readonly transcript: string;
    readonly capturedAt: string;
    readonly intent: string;
    readonly entities: Readonly<Record<string, string>>;
    readonly source: "voice";
    readonly originalPreserved: true;
}
export type ProvenanceKind = "author-owned" | "user-uploaded" | "ai-generated" | "external-research" | "public-domain" | "licensed" | "real-person" | "trademarked" | "unknown";
export interface CreativeProvenance {
    readonly id: string;
    readonly projectId: string;
    readonly artifactId: string;
    readonly kind: ProvenanceKind;
    readonly source: string;
    readonly consentStatus: "not-required" | "pending" | "granted" | "denied";
    readonly recordedAt: string;
    readonly notes: string;
}
export interface BookGenomeNode {
    readonly id: string;
    readonly component: BookGenomeComponent;
    readonly label: string;
    readonly references: readonly string[];
    readonly metadata: Readonly<Record<string, string>>;
}
export interface BookGenome {
    readonly formatVersion: typeof FINAL_PRODUCT_FORMAT_VERSION;
    readonly projectId: string;
    readonly generatedAt: string;
    readonly nodes: readonly BookGenomeNode[];
}
export interface GenomeImpact {
    readonly changedNodeId: string;
    readonly affectedComponents: readonly BookGenomeComponent[];
    readonly affectedNodeIds: readonly string[];
    readonly explanation: string;
    readonly requiresAuthorApproval: true;
}
export declare const DELIVERY_AUDIT_CATEGORIES: readonly ["canon", "continuity", "timeline", "characters", "pov", "style", "grammar", "formatting", "research", "artwork", "cover", "metadata", "publishing"];
export type FinalDeliveryAuditCategory = typeof DELIVERY_AUDIT_CATEGORIES[number];
export interface FinalDeliveryCheck {
    readonly category: FinalDeliveryAuditCategory;
    readonly passed: boolean;
    readonly message: string;
    readonly blocking: boolean;
}
export interface FinalProductAudit {
    readonly id: string;
    readonly projectId: string;
    readonly generatedAt: string;
    readonly checks: readonly FinalDeliveryCheck[];
    readonly passed: number;
    readonly attention: number;
    readonly blocking: number;
    readonly status: "ready-for-author-approval" | "attention-required" | "blocked";
}
export declare function createCapabilityGap(input: {
    id: string;
    projectId: string;
    capability: string;
    reason: string;
    now?: string;
}): CapabilityGap;
export declare function advanceCapabilityGap(gap: CapabilityGap, status: CapabilityGapStatus, note: string, now?: string): CapabilityGap;
export declare function defaultOwnershipPolicy(): OwnershipPolicy;
export declare function defaultAccessibilityProfile(): AccessibilityProfile;
export declare function createVoiceCommand(input: {
    id: string;
    projectId: string;
    transcript: string;
    intent: string;
    entities?: Readonly<Record<string, string>>;
    capturedAt?: string;
}): VoiceCommand;
export declare function createCreativeProvenance(input: {
    id: string;
    projectId: string;
    artifactId: string;
    kind: ProvenanceKind;
    source: string;
    consentStatus: CreativeProvenance["consentStatus"];
    notes?: string;
    recordedAt?: string;
}): CreativeProvenance;
export declare function createBookGenome(input: {
    projectId: string;
    nodes: readonly BookGenomeNode[];
    now?: string;
}): BookGenome;
export declare function identifyGenomeImpact(genome: BookGenome, changedNodeId: string): GenomeImpact;
export declare function createFinalProductAudit(input: {
    id: string;
    projectId: string;
    checks: readonly FinalDeliveryCheck[];
    generatedAt?: string;
}): FinalProductAudit;
