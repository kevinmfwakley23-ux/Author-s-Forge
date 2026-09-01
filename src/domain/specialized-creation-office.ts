import { createSpecializedCreationProject, SPECIALIZED_CREATION_MODES, validateSpecializedCreationProject, type CreateSpecializedCreationInput, type SpecializedCreationMode } from "./specialized-creation";
import { createSpecializedCreationWorkspace, type SpecializedCreationWorkspace, type WorkspaceAsset, type WorkspaceDocument } from "./specialized-creation-workspace";
import { createProductionSpec, validateProductionSpec, type ProductionArtifactKind, type ProductionSpec } from "./specialized-creation-production";

export const SPECIALIZED_CREATION_OFFICE_FORMAT_VERSION = 1 as const;
export const SPECIALIZED_CREATION_STAGES = ["brief", "plan", "create", "review", "production"] as const;
export type SpecializedCreationStage = (typeof SPECIALIZED_CREATION_STAGES)[number];

export interface SpecializedCreationOfficeRecord {
  readonly formatVersion: typeof SPECIALIZED_CREATION_OFFICE_FORMAT_VERSION;
  readonly id: string;
  readonly projectId: string;
  readonly stage: SpecializedCreationStage;
  readonly workspace: SpecializedCreationWorkspace;
  readonly production: ProductionSpec;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateSpecializedCreationOfficeInput extends CreateSpecializedCreationInput {
  readonly production?: Partial<Omit<ProductionSpec, "mode" | "allowedArtifacts">>;
}

export function createSpecializedCreationOffice(input: CreateSpecializedCreationOfficeInput): SpecializedCreationOfficeRecord {
  if (!SPECIALIZED_CREATION_MODES.includes(input.mode)) throw new Error(`Unsupported specialized creation mode: ${String(input.mode)}`);
  const now = input.now ?? new Date().toISOString();
  const project = createSpecializedCreationProject({ ...input, now });
  const profile = project.bleedProfile;
  const production = createProductionSpec(input.mode, {
    widthInches: input.production?.widthInches ?? profile.widthInches,
    heightInches: input.production?.heightInches ?? profile.heightInches,
    bleedInches: input.production?.bleedInches ?? profile.bleedInches,
    safeMarginInches: input.production?.safeMarginInches ?? profile.safeMarginInches,
    dpi: input.production?.dpi ?? Math.max(300, profile.dpi),
    colorProfile: input.production?.colorProfile ?? profile.colorProfile,
  });
  requireProductionReady(production);
  return {
    formatVersion: SPECIALIZED_CREATION_OFFICE_FORMAT_VERSION,
    id: project.id,
    projectId: project.projectId,
    stage: "brief",
    workspace: createSpecializedCreationWorkspace(project),
    production,
    createdAt: now,
    updatedAt: now,
  };
}

export function validateSpecializedCreationOffice(value: SpecializedCreationOfficeRecord): SpecializedCreationOfficeRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid specialized creation office record.");
  if (value.formatVersion !== SPECIALIZED_CREATION_OFFICE_FORMAT_VERSION) throw new Error("Unsupported specialized creation office format.");
  if (!value.id?.trim() || !value.projectId?.trim()) throw new Error("Specialized creation office identity is incomplete.");
  if (!SPECIALIZED_CREATION_STAGES.includes(value.stage)) throw new Error("Invalid specialized creation stage.");
  validateSpecializedCreationProject(value.workspace.project);
  if (value.workspace.project.id !== value.id || value.workspace.project.projectId !== value.projectId) throw new Error("Specialized creation workspace identity does not match office record.");
  if (value.production.mode !== value.workspace.project.mode) throw new Error("Specialized creation production mode does not match workspace mode.");
  requireProductionReady(value.production);
  if (!Array.isArray(value.workspace.assets) || !Array.isArray(value.workspace.documents)) throw new Error("Invalid specialized creation workspace collections.");
  return cloneSpecializedCreationOffice(value);
}

export function advanceSpecializedCreationStage(record: SpecializedCreationOfficeRecord, now = new Date().toISOString()): SpecializedCreationOfficeRecord {
  const current = SPECIALIZED_CREATION_STAGES.indexOf(record.stage);
  if (current < 0) throw new Error("Invalid specialized creation stage.");
  if (current === SPECIALIZED_CREATION_STAGES.length - 1) throw new Error("Specialized creation is already at production stage.");
  return validateSpecializedCreationOffice({ ...record, stage: SPECIALIZED_CREATION_STAGES[current + 1], updatedAt: now });
}

export function replaceSpecializedProduction(record: SpecializedCreationOfficeRecord, production: ProductionSpec, now = new Date().toISOString()): SpecializedCreationOfficeRecord {
  if (production.mode !== record.workspace.project.mode) throw new Error("Production mode cannot differ from specialized creation mode.");
  requireProductionReady(production);
  return validateSpecializedCreationOffice({ ...record, production: cloneProduction(production), updatedAt: now });
}

export function addSpecializedDocument(record: SpecializedCreationOfficeRecord, document: WorkspaceDocument, now = new Date().toISOString()): SpecializedCreationOfficeRecord {
  if (!document.id?.trim() || !document.title?.trim()) throw new Error("Specialized creation document id and title are required.");
  if (record.workspace.documents.some((item) => item.id === document.id)) throw new Error(`Duplicate specialized creation document id "${document.id}".`);
  const workspace = { ...record.workspace, documents: [...record.workspace.documents, cloneDocument(document)] };
  return validateSpecializedCreationOffice({ ...record, workspace, updatedAt: now });
}

export function addSpecializedAsset(record: SpecializedCreationOfficeRecord, asset: WorkspaceAsset, now = new Date().toISOString()): SpecializedCreationOfficeRecord {
  if (asset.projectId !== record.projectId) throw new Error("Specialized creation asset belongs to another project.");
  if (!asset.id?.trim() || !asset.name?.trim() || !asset.uri?.trim()) throw new Error("Specialized creation asset id, name, and uri are required.");
  if (record.workspace.assets.some((item) => item.id === asset.id)) throw new Error(`Duplicate specialized creation asset id "${asset.id}".`);
  const workspace = { ...record.workspace, assets: [...record.workspace.assets, cloneAsset(asset)] };
  return validateSpecializedCreationOffice({ ...record, workspace, updatedAt: now });
}

export function validateSpecializedArtifact(record: SpecializedCreationOfficeRecord, artifact: ProductionArtifactKind): void {
  const issues = validateProductionSpec(record.production, artifact).filter((issue) => issue.blocking);
  if (issues.length) throw new Error(issues.map((issue) => `${issue.code}: ${issue.message}`).join("; "));
}

export function cloneSpecializedCreationOffice(record: SpecializedCreationOfficeRecord): SpecializedCreationOfficeRecord {
  return {
    ...record,
    workspace: {
      ...record.workspace,
      project: { ...record.workspace.project, bleedProfile: { ...record.workspace.project.bleedProfile } },
      assets: record.workspace.assets.map(cloneAsset),
      documents: record.workspace.documents.map(cloneDocument),
    },
    production: cloneProduction(record.production),
  };
}

function requireProductionReady(spec: ProductionSpec): void {
  const issues = validateProductionSpec(spec).filter((issue) => issue.blocking);
  if (issues.length) throw new Error(issues.map((issue) => `${issue.code}: ${issue.message}`).join("; "));
}

function cloneProduction(spec: ProductionSpec): ProductionSpec { return { ...spec, allowedArtifacts: [...spec.allowedArtifacts] }; }
function cloneAsset(asset: WorkspaceAsset): WorkspaceAsset { return { ...asset, tags: [...asset.tags] }; }
function cloneDocument(document: WorkspaceDocument): WorkspaceDocument { return { ...document, elements: document.elements.map((element) => ({ ...element, assetIds: [...element.assetIds] })) }; }

export type { SpecializedCreationMode };
