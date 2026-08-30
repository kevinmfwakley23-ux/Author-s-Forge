export const SPECIALIZED_COMIC_FORMAT_VERSION = "1.0.0" as const;

export type ComicPanelShot = "establishing" | "wide" | "medium" | "close-up" | "extreme-close-up" | "over-shoulder";
export type ComicPanelStatus = "scripted" | "storyboarded" | "rendered" | "review" | "approved";

export type ComicCharacterAnchor = {
  characterId: string;
  referenceAssetIds: string[];
  identityLocked: boolean;
  wardrobeState?: string;
};

export type ComicPanel = {
  id: string;
  pageNumber: number;
  panelNumber: number;
  shot: ComicPanelShot;
  description: string;
  characterAnchors: ComicCharacterAnchor[];
  dialogue: string[];
  captions: string[];
  soundEffects: string[];
  status: ComicPanelStatus;
};

export type ComicPage = {
  id: string;
  pageNumber: number;
  panels: ComicPanel[];
  status: "draft" | "review" | "approved";
};

export type ComicBookWorkspace = {
  formatVersion: typeof SPECIALIZED_COMIC_FORMAT_VERSION;
  projectId: string;
  title: string;
  styleReferenceAssetIds: string[];
  pages: ComicPage[];
};

export function createComicBookWorkspace(input: { projectId: string; title: string }): ComicBookWorkspace {
  if (!input.projectId.trim()) throw new Error("Comic project id is required");
  if (!input.title.trim()) throw new Error("Comic title is required");
  return { formatVersion: SPECIALIZED_COMIC_FORMAT_VERSION, projectId: input.projectId, title: input.title.trim(), styleReferenceAssetIds: [], pages: [] };
}

export function validateComicPanel(panel: ComicPanel): void {
  if (!panel.id || panel.pageNumber < 1 || panel.panelNumber < 1) throw new Error("Invalid comic panel identity");
  if (!panel.description.trim()) throw new Error("Comic panel description is required");
  for (const anchor of panel.characterAnchors) {
    if (!anchor.characterId.trim()) throw new Error("Comic character anchor requires a character id");
    if (anchor.identityLocked && anchor.referenceAssetIds.length === 0) throw new Error("Locked comic character requires a visual reference");
  }
}

export function approveComicPanel(panel: ComicPanel): ComicPanel {
  validateComicPanel(panel);
  if (panel.characterAnchors.some((anchor) => !anchor.identityLocked && anchor.referenceAssetIds.length === 0)) {
    throw new Error("Comic panel cannot be approved without resolved character references");
  }
  return { ...panel, status: "approved" };
}
