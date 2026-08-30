import type { SpecializedCreationMode } from "../domain/specialized-creation";
import {
  createSpecializedCreationWorkspace,
  supportedWorkspaceRoles,
  type SpecializedCreationWorkspace,
  type WorkspaceAsset,
  type WorkspaceDocument,
  type WorkspaceElement,
} from "../domain/specialized-creation-workspace";
import type { SpecializedCreationProject } from "../domain/specialized-creation";

export type SpecializedCreationBrief = {
  mode: SpecializedCreationMode;
  objective: string;
  audience?: string;
  constraints?: string[];
};

export class SpecializedCreationService {
  createWorkspace(project: SpecializedCreationProject): SpecializedCreationWorkspace {
    return createSpecializedCreationWorkspace(project);
  }

  supportedRoles(mode: SpecializedCreationMode) {
    return supportedWorkspaceRoles(mode);
  }

  addAsset(workspace: SpecializedCreationWorkspace, asset: WorkspaceAsset): SpecializedCreationWorkspace {
    if (asset.projectId !== workspace.project.id) throw new Error("Asset belongs to a different project");
    if (workspace.assets.some((existing) => existing.id === asset.id)) throw new Error("Duplicate specialized asset id");
    return { ...workspace, assets: [...workspace.assets, { ...asset, tags: [...asset.tags] }] };
  }

  addDocument(workspace: SpecializedCreationWorkspace, document: WorkspaceDocument): SpecializedCreationWorkspace {
    if (workspace.documents.some((existing) => existing.id === document.id)) throw new Error("Duplicate specialized document id");
    const allowed = new Set(supportedWorkspaceRoles(workspace.project.mode));
    for (const element of document.elements) {
      if (!allowed.has(element.role)) throw new Error(`Role ${element.role} is not supported for ${workspace.project.mode}`);
    }
    return { ...workspace, documents: [...workspace.documents, { ...document, elements: document.elements.map((element) => ({ ...element, assetIds: [...element.assetIds] })) }] };
  }

  validateBrief(brief: SpecializedCreationBrief): void {
    if (!brief.objective.trim()) throw new Error("Specialized creation objective is required");
    if (brief.constraints?.some((constraint) => !constraint.trim())) throw new Error("Specialized creation constraints cannot be blank");
  }
}
