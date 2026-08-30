export const COMIC_BOOK_FORMAT_VERSION = "1.0.0" as const;

export type ComicCharacterAnchor = {
  characterId: string;
  referenceAssetIds: string[];
  locked: boolean;
};

export type ComicPanel = {
  id: string;
  pageId: string;
  sequence: number;
  description: string;
  characterIds: string[];
  locationId?: string;
  dialogue: string[];
  caption?: string;
  soundEffects: string[];
  referenceAssetIds: string[];
  approved: boolean;
};

export type ComicPage = {
  id: string;
  sequence: number;
  panelIds: string[];
  layout: "grid" | "cinematic" | "splash" | "custom";
  approved: boolean;
};

export type ComicBookProject = {
  formatVersion: typeof COMIC_BOOK_FORMAT_VERSION;
  specializedCreationId: string;
  issueTitle: string;
  issueNumber?: string;
  styleReferenceAssetIds: string[];
  characterAnchors: ComicCharacterAnchor[];
  pages: ComicPage[];
  panels: ComicPanel[];
};

export function createComicBookProject(specializedCreationId: string, issueTitle: string): ComicBookProject {
  if (!specializedCreationId.trim()) throw new Error("Specialized creation id is required");
  if (!issueTitle.trim()) throw new Error("Comic issue title is required");
  return {
    formatVersion: COMIC_BOOK_FORMAT_VERSION,
    specializedCreationId,
    issueTitle: issueTitle.trim(),
    styleReferenceAssetIds: [],
    characterAnchors: [],
    pages: [],
    panels: [],
  };
}

export function addComicCharacterAnchor(project: ComicBookProject, anchor: ComicCharacterAnchor): ComicBookProject {
  if (!anchor.characterId.trim()) throw new Error("Comic character id is required");
  if (project.characterAnchors.some((item) => item.characterId === anchor.characterId)) throw new Error("Comic character anchor already exists");
  return { ...project, characterAnchors: [...project.characterAnchors, { ...anchor, referenceAssetIds: [...anchor.referenceAssetIds] }] };
}

export function addComicPage(project: ComicBookProject, page: ComicPage): ComicBookProject {
  if (project.pages.some((item) => item.id === page.id)) throw new Error("Comic page already exists");
  if (page.panelIds.length === 0) throw new Error("Comic page requires at least one panel");
  return { ...project, pages: [...project.pages, { ...page, panelIds: [...page.panelIds] }] };
}

export function addComicPanel(project: ComicBookProject, panel: ComicPanel): ComicBookProject {
  if (project.panels.some((item) => item.id === panel.id)) throw new Error("Comic panel already exists");
  if (panel.sequence < 1) throw new Error("Comic panel sequence must be positive");
  return { ...project, panels: [...project.panels, { ...panel, characterIds: [...panel.characterIds], dialogue: [...panel.dialogue], soundEffects: [...panel.soundEffects], referenceAssetIds: [...panel.referenceAssetIds] }] };
}

export function findComicPanel(project: ComicBookProject, panelId: string): ComicPanel | undefined {
  return project.panels.find((panel) => panel.id === panelId);
}

export function validateComicBookProject(project: ComicBookProject): void {
  if (project.formatVersion !== COMIC_BOOK_FORMAT_VERSION) throw new Error("Unsupported comic book format version");
  const pageIds = new Set(project.pages.map((page) => page.id));
  for (const panel of project.panels) {
    if (!pageIds.has(panel.pageId)) throw new Error(`Comic panel ${panel.id} references a missing page`);
    const lockedCharacterIds = new Set(project.characterAnchors.filter((anchor) => anchor.locked).map((anchor) => anchor.characterId));
    for (const characterId of panel.characterIds) {
      if (!lockedCharacterIds.has(characterId)) throw new Error(`Comic panel ${panel.id} uses character ${characterId} without a locked character anchor`);
    }
  }
}
