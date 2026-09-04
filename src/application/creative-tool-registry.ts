export const CREATIVE_TOOL_REGISTRY_FORMAT_VERSION = 1 as const;

export const CREATIVE_TOOL_CATEGORIES = ["research", "planning", "writing", "editing", "production", "memory"] as const;
export type CreativeToolCategory = typeof CREATIVE_TOOL_CATEGORIES[number];

export const CREATIVE_TOOL_APPROVAL_CLASSES = ["read-only", "author-step", "proposal", "artifact"] as const;
export type CreativeToolApprovalClass = typeof CREATIVE_TOOL_APPROVAL_CLASSES[number];

export const CREATIVE_TOOL_PROVIDER_REQUIREMENTS = ["none", "configured-ai", "hosted-research"] as const;
export type CreativeToolProviderRequirement = typeof CREATIVE_TOOL_PROVIDER_REQUIREMENTS[number];

export const CREATIVE_TOOL_STATE_EFFECTS = [
  "none",
  "working-research",
  "candidate-response",
  "proposal-ledger",
  "artifact-response",
  "working-memory",
] as const;
export type CreativeToolStateEffect = typeof CREATIVE_TOOL_STATE_EFFECTS[number];

export const CREATIVE_TOOL_SCOPES = ["project", "book", "chapter", "scene"] as const;
export type CreativeToolScope = typeof CREATIVE_TOOL_SCOPES[number];

export interface CreativeToolDescriptor {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: CreativeToolCategory;
  readonly method: "POST";
  readonly pathTemplate: string;
  readonly approvalClass: CreativeToolApprovalClass;
  readonly providerRequirement: CreativeToolProviderRequirement;
  readonly stateEffect: CreativeToolStateEffect;
  readonly requiredScope: readonly CreativeToolScope[];
  readonly authorCanReviewBeforeMutation: boolean;
  readonly mayChangeCanon: false;
  readonly mayDirectlyChangeManuscript: false;
}

const TOOL_DEFINITIONS: readonly CreativeToolDescriptor[] = Object.freeze([
  tool({
    id: "project.context",
    title: "Ground project context",
    description: "Assemble the current project's salient author-controlled context without mutating project state.",
    category: "planning",
    pathTemplate: "/api/projects/:projectId/context",
    approvalClass: "read-only",
    providerRequirement: "none",
    stateEffect: "none",
    requiredScope: ["project"],
    authorCanReviewBeforeMutation: true,
  }),
  tool({
    id: "research.live",
    title: "Run source-backed research",
    description: "Use Forge's hosted research boundary and persist returned claims as working research, never automatic canon.",
    category: "research",
    pathTemplate: "/api/projects/:projectId/research/live",
    approvalClass: "author-step",
    providerRequirement: "hosted-research",
    stateEffect: "working-research",
    requiredScope: ["project"],
    authorCanReviewBeforeMutation: true,
  }),
  tool({
    id: "architecture.generate",
    title: "Generate architecture candidate",
    description: "Generate a story architecture candidate for author review without silently persisting it into manuscript structure.",
    category: "planning",
    pathTemplate: "/api/projects/:projectId/ai/architecture",
    approvalClass: "author-step",
    providerRequirement: "configured-ai",
    stateEffect: "candidate-response",
    requiredScope: ["project"],
    authorCanReviewBeforeMutation: true,
  }),
  tool({
    id: "writing.propose",
    title: "Create durable writing proposal",
    description: "Generate scene prose through the durable AI proposal ledger; separate author accept/apply remains required.",
    category: "writing",
    pathTemplate: "/api/projects/:projectId/ai/writing/generate",
    approvalClass: "proposal",
    providerRequirement: "configured-ai",
    stateEffect: "proposal-ledger",
    requiredScope: ["project", "book", "chapter", "scene"],
    authorCanReviewBeforeMutation: true,
  }),
  tool({
    id: "editing.analyze",
    title: "Analyze manuscript craft",
    description: "Run Forge's deterministic multi-lens editorial analysis without rewriting manuscript content.",
    category: "editing",
    pathTemplate: "/api/projects/:projectId/edit",
    approvalClass: "read-only",
    providerRequirement: "none",
    stateEffect: "none",
    requiredScope: ["project", "scene"],
    authorCanReviewBeforeMutation: true,
  }),
  tool({
    id: "production.export",
    title: "Render production artifact",
    description: "Render real production bytes through Forge's manuscript production engine without claiming retailer publication.",
    category: "production",
    pathTemplate: "/api/projects/:projectId/export",
    approvalClass: "artifact",
    providerRequirement: "none",
    stateEffect: "artifact-response",
    requiredScope: ["project", "book"],
    authorCanReviewBeforeMutation: true,
  }),
  tool({
    id: "memory.record-working",
    title: "Record working workflow evidence",
    description: "Persist an author-approved workflow record as working creative memory; it cannot become story canon through this tool.",
    category: "memory",
    pathTemplate: "/api/projects/:projectId/memory",
    approvalClass: "author-step",
    providerRequirement: "none",
    stateEffect: "working-memory",
    requiredScope: ["project"],
    authorCanReviewBeforeMutation: true,
  }),
]);

export interface CreativeToolRegistrySnapshot {
  readonly formatVersion: typeof CREATIVE_TOOL_REGISTRY_FORMAT_VERSION;
  readonly tools: readonly CreativeToolDescriptor[];
}

export function creativeToolRegistrySnapshot(): CreativeToolRegistrySnapshot {
  return { formatVersion: CREATIVE_TOOL_REGISTRY_FORMAT_VERSION, tools: TOOL_DEFINITIONS };
}

export function listCreativeTools(): readonly CreativeToolDescriptor[] {
  return TOOL_DEFINITIONS;
}

export function creativeToolById(id: string): CreativeToolDescriptor {
  const normalized = String(id ?? "").trim();
  const found = TOOL_DEFINITIONS.find((candidate) => candidate.id === normalized);
  if (!found) throw new Error(`Unknown Forge creative tool "${normalized || "(empty)"}".`);
  return found;
}

export function resolveCreativeToolPath(id: string, projectId: string): string {
  if (!/^[A-Za-z0-9_-]+$/u.test(projectId)) throw new Error("Invalid project id for creative tool routing.");
  return creativeToolById(id).pathTemplate.replace(":projectId", encodeURIComponent(projectId));
}

function tool(input: Omit<CreativeToolDescriptor, "method" | "mayChangeCanon" | "mayDirectlyChangeManuscript">): CreativeToolDescriptor {
  const candidate: CreativeToolDescriptor = Object.freeze({
    ...input,
    method: "POST",
    mayChangeCanon: false,
    mayDirectlyChangeManuscript: false,
    requiredScope: Object.freeze([...input.requiredScope]),
  });
  validateTool(candidate);
  return candidate;
}

function validateTool(candidate: CreativeToolDescriptor): void {
  if (!/^[a-z][a-z0-9.-]+$/u.test(candidate.id)) throw new Error(`Invalid creative tool id "${candidate.id}".`);
  if (!candidate.title.trim() || !candidate.description.trim()) throw new Error(`Creative tool "${candidate.id}" requires title and description.`);
  if (!candidate.pathTemplate.startsWith("/api/projects/:projectId/")) throw new Error(`Creative tool "${candidate.id}" must stay inside the project API boundary.`);
  if (candidate.pathTemplate.includes("/apply") || candidate.pathTemplate.includes("/content")) throw new Error(`Creative tool "${candidate.id}" cannot directly apply proposals or manuscript content.`);
  if (!CREATIVE_TOOL_CATEGORIES.includes(candidate.category)) throw new Error(`Creative tool "${candidate.id}" has invalid category.`);
  if (!CREATIVE_TOOL_APPROVAL_CLASSES.includes(candidate.approvalClass)) throw new Error(`Creative tool "${candidate.id}" has invalid approval class.`);
  if (!CREATIVE_TOOL_PROVIDER_REQUIREMENTS.includes(candidate.providerRequirement)) throw new Error(`Creative tool "${candidate.id}" has invalid provider requirement.`);
  if (!CREATIVE_TOOL_STATE_EFFECTS.includes(candidate.stateEffect)) throw new Error(`Creative tool "${candidate.id}" has invalid state effect.`);
  if (!candidate.requiredScope.length || candidate.requiredScope.some((scope) => !CREATIVE_TOOL_SCOPES.includes(scope))) throw new Error(`Creative tool "${candidate.id}" has invalid required scope.`);
}

const duplicateIds = TOOL_DEFINITIONS.map((candidate) => candidate.id).filter((id, index, ids) => ids.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`Duplicate Forge creative tool ids: ${duplicateIds.join(", ")}`);
