import type { ComicData, ComicPanelData } from "../domain/specialized-creation-office";
import { setComicReadingDirection, type ComicReadingDirection } from "./specialized-creation-finishing";

export type ComicPacingIntent = "standard" | "establishing" | "beat" | "transition" | "reveal" | "splash";
export type ComicLetteringKind = "dialogue" | "caption" | "sfx";

export interface ComicPanelLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly gutterInches?: number;
  readonly templateId?: string;
}

export interface ComicLetteringSemantic {
  readonly id: string;
  readonly kind: ComicLetteringKind;
  readonly sourceIndex: number;
  readonly readingOrder: number;
  readonly speaker?: string;
  readonly tailTarget?: Readonly<{ x: number; y: number }>;
}

export interface ComicAuthoringPanel extends ComicPanelData {
  readonly pacingIntent?: ComicPacingIntent;
  readonly layout?: ComicPanelLayout;
  readonly letteringSemantics?: readonly ComicLetteringSemantic[];
}

export interface ComicAuthoringPage {
  readonly page: number;
  readonly pageTurnIntent?: string;
  readonly pacingIntent?: ComicPacingIntent;
  readonly panels: readonly ComicAuthoringPanel[];
}

export interface ComicAuthoringData extends ComicData {
  readonly readingDirection?: ComicReadingDirection;
  readonly pages: readonly ComicAuthoringPage[];
}

export interface ComicPacingPanelSummary {
  readonly panelId: string;
  readonly order: number;
  readonly relativeArea?: number;
  readonly pacingIntent: ComicPacingIntent;
}

export interface ComicPacingPageSummary {
  readonly page: number;
  readonly panelCount: number;
  readonly pageTurnIntent?: string;
  readonly pacingIntent: ComicPacingIntent;
  readonly panels: readonly ComicPacingPanelSummary[];
}

export interface ComicModePreflightIssue {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly page?: number;
  readonly panelId?: string;
  readonly letteringId?: string;
}

export interface ComicBrainContextRequest {
  readonly capability: "comic-panel";
  readonly issueTitle: string;
  readonly issueNumber?: string;
  readonly page: number;
  readonly panelId: string;
  readonly panelDescription: string;
  readonly requestedContext: readonly ("characters" | "visual-identities" | "locations" | "props" | "style" | "continuity" | "dialogue-voice")[];
}

export function setComicAuthoringReadingDirection(data: ComicData, direction: ComicReadingDirection): ComicAuthoringData {
  return freezeComic(setComicReadingDirection(data, direction) as ComicAuthoringData);
}

export function setComicPagePacingIntent(data: ComicData, pageNumber: number, intent: ComicPacingIntent, pageTurnIntent?: string): ComicAuthoringData {
  return mapPage(data, pageNumber, (page) => ({
    ...page,
    pacingIntent: intent,
    ...(pageTurnIntent !== undefined ? { pageTurnIntent: pageTurnIntent.trim() } : {}),
  }));
}

export function setComicPanelPacingIntent(data: ComicData, pageNumber: number, panelId: string, intent: ComicPacingIntent): ComicAuthoringData {
  return mapPanel(data, pageNumber, panelId, (panel) => ({ ...panel, pacingIntent: intent }));
}

export function setComicPanelLayout(data: ComicData, pageNumber: number, panelId: string, layout: ComicPanelLayout): ComicAuthoringData {
  validateLayout(layout);
  return mapPanel(data, pageNumber, panelId, (panel) => ({
    ...panel,
    layout: Object.freeze({ ...layout }),
  }));
}

export function setComicPanelLetteringSemantics(
  data: ComicData,
  pageNumber: number,
  panelId: string,
  semantics: readonly ComicLetteringSemantic[],
): ComicAuthoringData {
  validateLetteringSemantics(semantics);
  return mapPanel(data, pageNumber, panelId, (panel) => ({
    ...panel,
    letteringSemantics: Object.freeze(semantics.map((semantic) => Object.freeze({
      ...semantic,
      ...(semantic.tailTarget ? { tailTarget: Object.freeze({ ...semantic.tailTarget }) } : {}),
    }))),
  }));
}

export function appendComicPanelArtCandidate(data: ComicData, pageNumber: number, panelId: string, assetId: string): ComicAuthoringData {
  const normalized = assetId.trim();
  if (!normalized) throw new Error("Comic art candidate asset id is required.");
  return mapPanel(data, pageNumber, panelId, (panel) => ({
    ...panel,
    assetIds: Object.freeze(panel.assetIds.includes(normalized) ? [...panel.assetIds] : [...panel.assetIds, normalized]),
  }));
}

export function comicPacingSummary(data: ComicData): readonly ComicPacingPageSummary[] {
  const comic = data as ComicAuthoringData;
  return Object.freeze([...comic.pages]
    .sort((a, b) => a.page - b.page)
    .map((page) => Object.freeze({
      page: page.page,
      panelCount: page.panels.length,
      ...(page.pageTurnIntent?.trim() ? { pageTurnIntent: page.pageTurnIntent.trim() } : {}),
      pacingIntent: page.pacingIntent ?? "standard",
      panels: Object.freeze([...page.panels]
        .sort((a, b) => a.order - b.order)
        .map((panel) => Object.freeze({
          panelId: panel.id,
          order: panel.order,
          ...(panel.layout ? { relativeArea: round(panel.layout.width * panel.layout.height) } : {}),
          pacingIntent: panel.pacingIntent ?? "standard",
        }))),
    })));
}

export function comicBrainContextRequest(data: ComicData, pageNumber: number, panelId: string): ComicBrainContextRequest {
  const comic = data as ComicAuthoringData;
  const page = comic.pages.find((candidate) => candidate.page === pageNumber);
  if (!page) throw new Error(`Comic page ${pageNumber} not found.`);
  const panel = page.panels.find((candidate) => candidate.id === panelId);
  if (!panel) throw new Error(`Comic panel "${panelId}" not found on page ${pageNumber}.`);
  return Object.freeze({
    capability: "comic-panel",
    issueTitle: comic.issueTitle,
    ...(comic.issueNumber ? { issueNumber: comic.issueNumber } : {}),
    page: pageNumber,
    panelId,
    panelDescription: panel.description,
    requestedContext: Object.freeze(["characters", "visual-identities", "locations", "props", "style", "continuity", "dialogue-voice"] as const),
  });
}

export function comicModePreflight(data: ComicData): readonly ComicModePreflightIssue[] {
  const comic = data as ComicAuthoringData;
  const issues: ComicModePreflightIssue[] = [];
  if (!comic.pages.length) return Object.freeze([issue("COMIC_NO_PAGES", "error", "Comic requires at least one page.")]);
  if (comic.readingDirection !== undefined && comic.readingDirection !== "ltr" && comic.readingDirection !== "rtl") {
    issues.push(issue("COMIC_READING_DIRECTION", "error", "Comic reading direction must be ltr or rtl."));
  }

  const orderedPages = [...comic.pages].sort((a, b) => a.page - b.page);
  orderedPages.forEach((page, pageIndex) => {
    if (page.page !== pageIndex + 1) issues.push(issue("COMIC_PAGE_ORDER", "warning", `Comic page order skips or starts outside contiguous sequence at page ${page.page}.`, page.page));
    if (!page.panels.length) issues.push(issue("COMIC_PAGE_EMPTY", "warning", `Comic page ${page.page} has no panels.`, page.page));
    const orderedPanels = [...page.panels].sort((a, b) => a.order - b.order);
    orderedPanels.forEach((panel, panelIndex) => {
      if (panel.order !== panelIndex + 1) issues.push(issue("COMIC_PANEL_ORDER", "error", `Comic page ${page.page} panel order must be contiguous from 1.`, page.page, panel.id));
      if (!panel.description.trim()) issues.push(issue("COMIC_PANEL_DESCRIPTION", "warning", `Comic panel ${panel.id} has no visual description.`, page.page, panel.id));
      if (panel.layout) {
        const layoutProblem = layoutIssue(panel.layout);
        if (layoutProblem) issues.push(issue("COMIC_PANEL_GEOMETRY", "error", `${panel.id}: ${layoutProblem}`, page.page, panel.id));
      }
      validatePanelLettering(page.page, panel, issues);
      if (panel.assetIds.length > 1) issues.push(issue("COMIC_ART_CANDIDATES", "info", `Comic panel ${panel.id} retains ${panel.assetIds.length} art candidates/revisions.`, page.page, panel.id));
    });

    const explicitLettering = orderedPanels.flatMap((panel) => panel.letteringSemantics ?? []);
    if (explicitLettering.length) {
      const readingOrders = explicitLettering.map((semantic) => semantic.readingOrder).sort((a, b) => a - b);
      if (readingOrders.some((value, index) => value !== index + 1)) {
        issues.push(issue("COMIC_LETTERING_READING_ORDER", "error", `Comic page ${page.page} lettering reading order must be contiguous from 1.`, page.page));
      }
    }
  });
  return Object.freeze(issues);
}

function validatePanelLettering(pageNumber: number, panel: ComicAuthoringPanel, issues: ComicModePreflightIssue[]): void {
  panel.dialogue.forEach((line, index) => {
    if (!line.speaker.trim()) issues.push(issue("COMIC_SPEAKER_MISSING", "error", `Dialogue ${index + 1} in panel ${panel.id} requires a speaker.`, pageNumber, panel.id));
    if (!line.text.trim()) issues.push(issue("COMIC_DIALOGUE_EMPTY", "error", `Dialogue ${index + 1} in panel ${panel.id} is empty.`, pageNumber, panel.id));
  });
  const semantics = panel.letteringSemantics ?? [];
  const ids = new Set<string>();
  const sourceKeys = new Set<string>();
  for (const semantic of semantics) {
    if (ids.has(semantic.id)) issues.push(issue("COMIC_LETTERING_ID_DUPLICATE", "error", `Duplicate lettering semantic id "${semantic.id}".`, pageNumber, panel.id, semantic.id));
    ids.add(semantic.id);
    const key = `${semantic.kind}:${semantic.sourceIndex}`;
    if (sourceKeys.has(key)) issues.push(issue("COMIC_LETTERING_SOURCE_DUPLICATE", "error", `Lettering source ${key} is annotated more than once.`, pageNumber, panel.id, semantic.id));
    sourceKeys.add(key);
    const sourceLength = semantic.kind === "dialogue" ? panel.dialogue.length : semantic.kind === "caption" ? panel.captions.length : panel.sfx.length;
    if (!Number.isInteger(semantic.sourceIndex) || semantic.sourceIndex < 0 || semantic.sourceIndex >= sourceLength) {
      issues.push(issue("COMIC_LETTERING_SOURCE", "error", `Lettering ${semantic.id} points to an invalid ${semantic.kind} source index.`, pageNumber, panel.id, semantic.id));
    }
    if (!Number.isInteger(semantic.readingOrder) || semantic.readingOrder < 1) issues.push(issue("COMIC_LETTERING_ORDER", "error", `Lettering ${semantic.id} requires a positive reading order.`, pageNumber, panel.id, semantic.id));
    if (semantic.kind === "dialogue") {
      const line = panel.dialogue[semantic.sourceIndex];
      if (line && semantic.speaker !== undefined && semantic.speaker.trim() !== line.speaker.trim()) {
        issues.push(issue("COMIC_SPEAKER_AMBIGUOUS", "error", `Lettering ${semantic.id} speaker does not match its structured dialogue source.`, pageNumber, panel.id, semantic.id));
      }
      if (!semantic.tailTarget) issues.push(issue("COMIC_TAIL_TARGET_MISSING", "warning", `Dialogue lettering ${semantic.id} has no tail target/anchor.`, pageNumber, panel.id, semantic.id));
    } else if (semantic.speaker) {
      issues.push(issue("COMIC_NON_DIALOGUE_SPEAKER", "warning", `${semantic.kind} lettering ${semantic.id} should not carry a dialogue speaker.`, pageNumber, panel.id, semantic.id));
    }
  }
}

function validateLetteringSemantics(semantics: readonly ComicLetteringSemantic[]): void {
  for (const semantic of semantics) {
    if (!semantic.id.trim()) throw new Error("Comic lettering semantic id is required.");
    if (!Number.isInteger(semantic.sourceIndex) || semantic.sourceIndex < 0) throw new Error("Comic lettering source index must be a non-negative integer.");
    if (!Number.isInteger(semantic.readingOrder) || semantic.readingOrder < 1) throw new Error("Comic lettering reading order must be a positive integer.");
    if (semantic.tailTarget && (!inUnit(semantic.tailTarget.x) || !inUnit(semantic.tailTarget.y))) throw new Error("Comic balloon tail target must use normalized 0..1 coordinates.");
  }
}

function validateLayout(layout: ComicPanelLayout): void {
  const problem = layoutIssue(layout);
  if (problem) throw new Error(problem);
}

function layoutIssue(layout: ComicPanelLayout): string | undefined {
  if (![layout.x, layout.y, layout.width, layout.height].every(Number.isFinite)) return "Comic panel layout coordinates must be finite.";
  if (layout.width <= 0 || layout.height <= 0) return "Comic panel layout width and height must be positive.";
  if (!inUnit(layout.x) || !inUnit(layout.y) || layout.x + layout.width > 1 || layout.y + layout.height > 1) return "Comic panel layout must fit normalized page coordinates from 0..1.";
  if (layout.gutterInches !== undefined && (!Number.isFinite(layout.gutterInches) || layout.gutterInches < 0)) return "Comic panel gutter must be non-negative.";
  return undefined;
}

function mapPage(data: ComicData, pageNumber: number, update: (page: ComicAuthoringPage) => ComicAuthoringPage): ComicAuthoringData {
  const comic = data as ComicAuthoringData;
  if (!comic.pages.some((page) => page.page === pageNumber)) throw new Error(`Comic page ${pageNumber} not found.`);
  return freezeComic({ ...comic, pages: comic.pages.map((page) => page.page === pageNumber ? update(page) : page) });
}

function mapPanel(data: ComicData, pageNumber: number, panelId: string, update: (panel: ComicAuthoringPanel) => ComicAuthoringPanel): ComicAuthoringData {
  return mapPage(data, pageNumber, (page) => {
    if (!page.panels.some((panel) => panel.id === panelId)) throw new Error(`Comic panel "${panelId}" not found on page ${pageNumber}.`);
    return { ...page, panels: page.panels.map((panel) => panel.id === panelId ? update(panel) : panel) };
  });
}

function freezeComic(data: ComicAuthoringData): ComicAuthoringData {
  return Object.freeze({
    ...data,
    pages: Object.freeze(data.pages.map((page) => Object.freeze({
      ...page,
      panels: Object.freeze(page.panels.map((panel) => Object.freeze({
        ...panel,
        dialogue: Object.freeze(panel.dialogue.map((line) => Object.freeze({ ...line }))),
        captions: Object.freeze([...panel.captions]),
        sfx: Object.freeze([...panel.sfx]),
        assetIds: Object.freeze([...panel.assetIds]),
        ...(panel.layout ? { layout: Object.freeze({ ...panel.layout }) } : {}),
        ...(panel.letteringSemantics ? { letteringSemantics: Object.freeze(panel.letteringSemantics.map((semantic) => Object.freeze({ ...semantic, ...(semantic.tailTarget ? { tailTarget: Object.freeze({ ...semantic.tailTarget }) } : {}) }))) } : {}),
      }))),
    }))),
  });
}

function issue(code: string, severity: ComicModePreflightIssue["severity"], message: string, page?: number, panelId?: string, letteringId?: string): ComicModePreflightIssue {
  return Object.freeze({ code, severity, message, ...(page !== undefined ? { page } : {}), ...(panelId ? { panelId } : {}), ...(letteringId ? { letteringId } : {}) });
}

function inUnit(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 1; }
function round(value: number): number { return Math.round(value * 10000) / 10000; }
