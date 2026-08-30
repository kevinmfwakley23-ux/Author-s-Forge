import type { SpecializedCreationMode, SpecializedCreationProject } from "./specialized-creation";

export const SPECIALIZED_CREATION_WORKSPACE_FORMAT_VERSION = "1.0.0" as const;

export type WorkspaceAssetKind = "reference" | "artwork" | "template" | "font" | "logo" | "icon" | "background";
export type WorkspaceElementRole = "character" | "location" | "prop" | "style" | "layout" | "copy" | "brand" | "game-rule";

export type WorkspaceAsset = {
  id: string;
  projectId: string;
  kind: WorkspaceAssetKind;
  name: string;
  uri: string;
  tags: string[];
  approved: boolean;
};

export type WorkspaceElement = {
  id: string;
  role: WorkspaceElementRole;
  name: string;
  assetIds: string[];
  locked: boolean;
  notes: string;
};

export type WorkspaceDocument = {
  id: string;
  title: string;
  elements: WorkspaceElement[];
  status: "draft" | "review" | "approved";
};

export type SpecializedCreationWorkspace = {
  formatVersion: typeof SPECIALIZED_CREATION_WORKSPACE_FORMAT_VERSION;
  project: SpecializedCreationProject;
  assets: WorkspaceAsset[];
  documents: WorkspaceDocument[];
};

export function createSpecializedCreationWorkspace(project: SpecializedCreationProject): SpecializedCreationWorkspace {
  return {
    formatVersion: SPECIALIZED_CREATION_WORKSPACE_FORMAT_VERSION,
    project,
    assets: [],
    documents: [],
  };
}

export function supportedWorkspaceRoles(mode: SpecializedCreationMode): WorkspaceElementRole[] {
  if (mode === "comic-book") return ["character", "location", "prop", "style", "layout", "copy"];
  if (mode === "trading-card-game") return ["character", "location", "prop", "style", "layout", "copy", "game-rule"];
  return ["style", "layout", "copy", "brand"];
}

export function lockWorkspaceElement(workspace: SpecializedCreationWorkspace, documentId: string, elementId: string): SpecializedCreationWorkspace {
  return {
    ...workspace,
    documents: workspace.documents.map((document) => document.id !== documentId ? document : {
      ...document,
      elements: document.elements.map((element) => element.id !== elementId ? element : { ...element, locked: true }),
    }),
  };
}

export function unlockWorkspaceElement(workspace: SpecializedCreationWorkspace, documentId: string, elementId: string): SpecializedCreationWorkspace {
  return {
    ...workspace,
    documents: workspace.documents.map((document) => document.id !== documentId ? document : {
      ...document,
      elements: document.elements.map((element) => element.id !== elementId ? element : { ...element, locked: false }),
    }),
  };
}
