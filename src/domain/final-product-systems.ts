export const FINAL_PRODUCT_FORMAT_VERSION = 1 as const;

export const BOOK_GENOME_COMPONENTS = [
  "premise", "theme", "genre", "voice", "canon", "characters", "relationships", "locations",
  "timeline", "events", "scenes", "objects", "clues", "reveals", "conflicts", "motivations",
  "research", "visual-identities", "art", "cover", "metadata", "publishing-state",
] as const;
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

export const DELIVERY_AUDIT_CATEGORIES = Object.freeze([
  "canon", "continuity", "timeline", "characters", "pov", "style", "grammar", "formatting",
  "research", "artwork", "cover", "metadata", "publishing",
] as const);
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

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} is required.`);
  return value.trim();
}

function assertProjectId(value: unknown): string {
  return requiredText(value, "Project id");
}

function validTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid timestamp.`);
  }
  return value;
}

export function createCapabilityGap(input: { id: string; projectId: string; capability: string; reason: string; now?: string }): CapabilityGap {
  const now = input.now ?? new Date().toISOString();
  return {
    id: requiredText(input.id, "Capability gap id"),
    projectId: assertProjectId(input.projectId),
    capability: requiredText(input.capability, "Capability"),
    reason: requiredText(input.reason, "Reason"),
    requestedAt: now,
    status: "requested",
    authority: "kings",
    auditTrail: [`${now}: Forge requested capability escalation.`],
  };
}

export function advanceCapabilityGap(gap: CapabilityGap, status: CapabilityGapStatus, note: string, now = new Date().toISOString()): CapabilityGap {
  const allowed: Record<CapabilityGapStatus, readonly CapabilityGapStatus[]> = {
    requested: ["researching", "rejected"],
    researching: ["planned", "rejected"],
    planned: ["building", "rejected"],
    building: ["testing", "rejected"],
    testing: ["verified", "building", "rejected"],
    verified: [],
    rejected: [],
  };
  if (!allowed[gap.status].includes(status)) throw new Error(`Invalid capability gap transition ${gap.status} -> ${status}.`);
  return { ...gap, status, auditTrail: [...gap.auditTrail, `${now}: ${requiredText(note, "Transition note")}`] };
}

export function defaultOwnershipPolicy(): OwnershipPolicy {
  return {
    projectIsolation: true,
    encryptedAtRest: false,
    explicitPermissions: true,
    exportEnabled: true,
    deleteEnabled: true,
    auditHistory: true,
    silentExternalUploads: false,
    researchConsentRequired: true,
    imageProcessingConsentRequired: true,
    providerTransparency: true,
    localFirst: true,
  };
}

export function defaultAccessibilityProfile(): AccessibilityProfile {
  return { keyboard: true, mouse: true, touch: true, voice: true, screenReader: true, largeText: true, highContrast: true };
}

export function createVoiceCommand(input: { id: string; projectId: string; transcript: string; intent: string; entities?: Readonly<Record<string, string>>; capturedAt?: string }): VoiceCommand {
  return {
    id: requiredText(input.id, "Voice command id"),
    projectId: assertProjectId(input.projectId),
    transcript: requiredText(input.transcript, "Transcript"),
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    intent: requiredText(input.intent, "Intent"),
    entities: { ...(input.entities ?? {}) },
    source: "voice",
    originalPreserved: true,
  };
}

export function createCreativeProvenance(input: { id: string; projectId: string; artifactId: string; kind: ProvenanceKind; source: string; consentStatus: CreativeProvenance["consentStatus"]; notes?: string; recordedAt?: string }): CreativeProvenance {
  const consentRequired = input.kind === "user-uploaded" || input.kind === "real-person" || input.kind === "trademarked";
  if (consentRequired && input.consentStatus !== "granted") throw new Error(`Consent must be granted for ${input.kind} creative provenance before the artifact can be used.`);
  if (input.consentStatus === "denied") throw new Error("Consent must be granted before creative provenance can be used.");
  return {
    id: requiredText(input.id, "Provenance id"),
    projectId: assertProjectId(input.projectId),
    artifactId: requiredText(input.artifactId, "Artifact id"),
    kind: input.kind,
    source: requiredText(input.source, "Source"),
    consentStatus: input.consentStatus,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    notes: input.notes?.trim() ?? "",
  };
}

export function createBookGenome(input: { projectId: string; nodes: readonly BookGenomeNode[]; now?: string }): BookGenome {
  const projectId = assertProjectId(input.projectId);
  const ids = new Set<string>();
  for (const node of input.nodes) {
    requiredText(node.id, "Genome node id");
    if (ids.has(node.id)) throw new Error(`Duplicate Book Genome node id "${node.id}".`);
    ids.add(node.id);
    if (!BOOK_GENOME_COMPONENTS.includes(node.component)) throw new Error(`Unsupported Book Genome component: ${node.component}.`);
    requiredText(node.label, "Genome node label");
  }
  return {
    formatVersion: FINAL_PRODUCT_FORMAT_VERSION,
    projectId,
    generatedAt: input.now ?? new Date().toISOString(),
    nodes: input.nodes.map((node) => ({
      id: node.id,
      component: node.component,
      label: node.label,
      references: [...node.references],
      metadata: { ...node.metadata },
    })),
  };
}

export function identifyGenomeImpact(genome: BookGenome, changedNodeId: string): GenomeImpact {
  const changed = genome.nodes.find((node) => node.id === changedNodeId);
  if (!changed) throw new Error(`Unknown Book Genome node "${changedNodeId}".`);
  const affected = genome.nodes.filter((node) => node.id !== changedNodeId && (node.references.includes(changedNodeId) || node.component !== changed.component && sharesReference(node, changed)));
  const components = [...new Set(affected.map((node) => node.component))];
  return {
    changedNodeId,
    affectedComponents: components,
    affectedNodeIds: affected.map((node) => node.id),
    explanation: `Changing ${changed.label} may affect ${affected.length} downstream Book Genome node(s). Review those dependencies before accepting the canon change.`,
    requiresAuthorApproval: true,
  };
}

function sharesReference(a: BookGenomeNode, b: BookGenomeNode): boolean {
  return a.references.some((reference) => b.references.includes(reference));
}

export function createFinalProductAudit(input: { id: string; projectId: string; checks: readonly FinalDeliveryCheck[]; generatedAt?: string }): FinalProductAudit {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Final product audit input object is required.");
  }

  const raw = input as unknown as Record<string, unknown>;
  const id = requiredText(raw.id, "Audit id");
  const projectId = assertProjectId(raw.projectId);
  if (!Array.isArray(raw.checks)) throw new Error("Final product audit checks must be an array.");
  if (raw.checks.length !== DELIVERY_AUDIT_CATEGORIES.length) {
    throw new Error(`Final product audit requires exactly ${DELIVERY_AUDIT_CATEGORIES.length} audit categories.`);
  }

  const checks = raw.checks.map((value): FinalDeliveryCheck => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Final product audit check must be an object.");
    }
    const check = value as Record<string, unknown>;
    if (typeof check.category !== "string" || !(DELIVERY_AUDIT_CATEGORIES as readonly string[]).includes(check.category)) {
      throw new Error(`Unsupported final audit category: ${String(check.category)}.`);
    }
    if (typeof check.passed !== "boolean") throw new Error("Final product audit check passed must be a boolean.");
    const message = requiredText(check.message, "Final product audit check message");
    if (typeof check.blocking !== "boolean") throw new Error("Final product audit check blocking must be a boolean.");
    return Object.freeze({
      category: check.category as FinalDeliveryAuditCategory,
      passed: check.passed,
      message,
      blocking: check.blocking,
    });
  });

  const categories = new Set(checks.map((check) => check.category));
  if (categories.size !== DELIVERY_AUDIT_CATEGORIES.length || !DELIVERY_AUDIT_CATEGORIES.every((category) => categories.has(category))) {
    throw new Error("Final product audit contains duplicate or missing categories.");
  }

  const generatedAt = raw.generatedAt === undefined
    ? new Date().toISOString()
    : validTimestamp(raw.generatedAt, "Final product audit generatedAt");
  const passed = checks.filter((check) => check.passed).length;
  const attention = checks.filter((check) => !check.passed && !check.blocking).length;
  const blocking = checks.filter((check) => !check.passed && check.blocking).length;

  return Object.freeze({
    id,
    projectId,
    generatedAt,
    checks: Object.freeze(checks),
    passed,
    attention,
    blocking,
    status: blocking > 0 ? "blocked" : attention > 0 ? "attention-required" : "ready-for-author-approval",
  });
}
