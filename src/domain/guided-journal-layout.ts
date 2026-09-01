import type { GuidedJournalPlan, JournalPageStyle } from "./guided-journal";

export const JOURNAL_INTERIOR_FORMAT_VERSION = 1 as const;
export const JOURNAL_PROMPT_ALIGNMENTS = ["left", "center", "right"] as const;
export type JournalPromptAlignment = typeof JOURNAL_PROMPT_ALIGNMENTS[number];

export interface JournalMargins {
  readonly topInches: number;
  readonly bottomInches: number;
  readonly insideInches: number;
  readonly outsideInches: number;
}

export interface JournalInteriorFormat {
  readonly formatVersion: typeof JOURNAL_INTERIOR_FORMAT_VERSION;
  readonly trimWidthInches: number;
  readonly trimHeightInches: number;
  readonly pageStyle: JournalPageStyle;
  readonly responsePagesPerPrompt: number;
  readonly promptFontFamily: string;
  readonly promptFontSizePt: number;
  readonly responseFontFamily: string;
  readonly responseFontSizePt: number;
  readonly promptAlignment: JournalPromptAlignment;
  readonly lineSpacingInches: number;
  readonly dotSpacingInches: number;
  readonly margins: JournalMargins;
  readonly showPageNumbers: boolean;
  readonly showCategoryLabel: boolean;
  readonly promptStartsOnNewPage: boolean;
  readonly includeTitlePage: boolean;
  readonly includeCopyrightPage: boolean;
  readonly includeIntroductionPages: number;
  readonly includeClosingPages: number;
}

export interface JournalProductionLayout {
  readonly formatVersion: typeof JOURNAL_INTERIOR_FORMAT_VERSION;
  readonly journalId: string;
  readonly projectId: string;
  readonly format: JournalInteriorFormat;
  readonly promptPages: number;
  readonly responsePages: number;
  readonly frontMatterPages: number;
  readonly backMatterPages: number;
  readonly totalPages: number;
}

export function createJournalInteriorFormat(input: Omit<JournalInteriorFormat, "formatVersion">): JournalInteriorFormat {
  const format: JournalInteriorFormat = Object.freeze({ ...input, formatVersion: JOURNAL_INTERIOR_FORMAT_VERSION, margins: Object.freeze({ ...input.margins }) });
  validateJournalInteriorFormat(format);
  return format;
}

export function validateJournalInteriorFormat(format: JournalInteriorFormat): void {
  if (format.formatVersion !== JOURNAL_INTERIOR_FORMAT_VERSION) throw new Error("Unsupported journal interior format version.");
  positive(format.trimWidthInches, "Journal trim width");
  positive(format.trimHeightInches, "Journal trim height");
  if (format.trimWidthInches < 4 || format.trimWidthInches > 8.5 || format.trimHeightInches < 6 || format.trimHeightInches > 11.69) throw new Error("Journal trim size is outside supported KDP paperback bounds.");
  if (!Number.isInteger(format.responsePagesPerPrompt) || format.responsePagesPerPrompt < 1 || format.responsePagesPerPrompt > 20) throw new Error("Journal response pages per prompt must be an integer from 1 to 20.");
  required(format.promptFontFamily, "Journal prompt font family");
  required(format.responseFontFamily, "Journal response font family");
  if (!Number.isFinite(format.promptFontSizePt) || format.promptFontSizePt < 8 || format.promptFontSizePt > 72) throw new Error("Journal prompt font size must be from 8 to 72 points.");
  if (!Number.isFinite(format.responseFontSizePt) || format.responseFontSizePt < 8 || format.responseFontSizePt > 36) throw new Error("Journal response font size must be from 8 to 36 points.");
  if (!JOURNAL_PROMPT_ALIGNMENTS.includes(format.promptAlignment)) throw new Error("Unsupported journal prompt alignment.");
  if (!Number.isFinite(format.lineSpacingInches) || format.lineSpacingInches < 0.15 || format.lineSpacingInches > 0.6) throw new Error("Journal line spacing must be from 0.15 to 0.6 inches.");
  if (!Number.isFinite(format.dotSpacingInches) || format.dotSpacingInches < 0.1 || format.dotSpacingInches > 0.5) throw new Error("Journal dot spacing must be from 0.1 to 0.5 inches.");
  for (const [label, value] of Object.entries(format.margins)) {
    if (!Number.isFinite(value) || value < 0.2 || value > 2) throw new Error(`Journal ${label} margin must be from 0.2 to 2 inches.`);
  }
  if (!Number.isInteger(format.includeIntroductionPages) || format.includeIntroductionPages < 0 || format.includeIntroductionPages > 50) throw new Error("Journal introduction pages must be an integer from 0 to 50.");
  if (!Number.isInteger(format.includeClosingPages) || format.includeClosingPages < 0 || format.includeClosingPages > 50) throw new Error("Journal closing pages must be an integer from 0 to 50.");
}

export function planJournalProductionLayout(journal: GuidedJournalPlan, format: JournalInteriorFormat): JournalProductionLayout {
  validateJournalInteriorFormat(format);
  if (journal.pageStyle !== format.pageStyle) throw new Error("Journal edition page style does not match the selected interior format.");
  if (journal.responsePagesPerPrompt !== format.responsePagesPerPrompt) throw new Error("Journal edition response-page count does not match the selected interior format.");
  const promptPages = format.promptStartsOnNewPage ? journal.prompts.length : Math.ceil(journal.prompts.length / 2);
  const responsePages = journal.prompts.length * format.responsePagesPerPrompt;
  const frontMatterPages = (format.includeTitlePage ? 1 : 0) + (format.includeCopyrightPage ? 1 : 0) + format.includeIntroductionPages;
  const backMatterPages = format.includeClosingPages;
  let totalPages = frontMatterPages + promptPages + responsePages + backMatterPages;
  if (totalPages % 2 !== 0) totalPages += 1;
  return Object.freeze({
    formatVersion: JOURNAL_INTERIOR_FORMAT_VERSION,
    journalId: journal.id,
    projectId: journal.projectId,
    format: Object.freeze({ ...format, margins: Object.freeze({ ...format.margins }) }),
    promptPages,
    responsePages,
    frontMatterPages,
    backMatterPages,
    totalPages,
  });
}

export function defaultJournalInteriorFormat(pageStyle: JournalPageStyle = "lined", responsePagesPerPrompt = 1): JournalInteriorFormat {
  return createJournalInteriorFormat({
    trimWidthInches: 6,
    trimHeightInches: 9,
    pageStyle,
    responsePagesPerPrompt,
    promptFontFamily: "Georgia",
    promptFontSizePt: 16,
    responseFontFamily: "Georgia",
    responseFontSizePt: 11,
    promptAlignment: "center",
    lineSpacingInches: 0.3,
    dotSpacingInches: 0.2,
    margins: { topInches: 0.5, bottomInches: 0.5, insideInches: 0.625, outsideInches: 0.5 },
    showPageNumbers: true,
    showCategoryLabel: false,
    promptStartsOnNewPage: true,
    includeTitlePage: true,
    includeCopyrightPage: true,
    includeIntroductionPages: 1,
    includeClosingPages: 1,
  });
}

function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function positive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number.`);
}
