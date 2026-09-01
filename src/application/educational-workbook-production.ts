import { createHash } from "node:crypto";
import type { EducationalWorkbookPlan, EducationalWorkbookActivityPage } from "../domain/educational-workbook";
import { validateProductionArtifact, type ProductionArtifact } from "../domain/manuscript-production";

export interface EducationalWorkbookPdfOptions {
  readonly trimWidthInches?: number;
  readonly trimHeightInches?: number;
  readonly marginInches?: number;
  readonly activityFontSizePt?: number;
  readonly answerFontSizePt?: number;
  readonly includeStudentNameLine?: boolean;
  readonly includeLearningObjectivesPage?: boolean;
  readonly includeDirectionsPage?: boolean;
  readonly includeAnswerKey?: boolean;
}

export interface RenderEducationalWorkbookPdfRequest {
  readonly workbook: EducationalWorkbookPlan;
  readonly bookId: string;
  readonly author: string;
  readonly copyrightHolder?: string;
  readonly options?: EducationalWorkbookPdfOptions;
  readonly now?: string;
}

export interface EducationalWorkbookPdfLayout {
  readonly trimWidthInches: number;
  readonly trimHeightInches: number;
  readonly totalPages: number;
  readonly activityPages: number;
  readonly answerKeyPages: number;
  readonly answerKeyIncluded: boolean;
}

export interface EducationalWorkbookPdfResult {
  readonly artifact: ProductionArtifact;
  readonly layout: EducationalWorkbookPdfLayout;
}

/** Produces a real printable PDF interior. KDP validation remains the responsibility of the shared Production + KDP Office. */
export class EducationalWorkbookProductionService {
  renderPdf(request: RenderEducationalWorkbookPdfRequest): EducationalWorkbookPdfResult {
    const bookId = required(request.bookId, "Workbook book id");
    const author = required(request.author, "Workbook author");
    const options = normalizeOptions(request.options);
    const width = options.trimWidthInches * 72;
    const height = options.trimHeightInches * 72;
    const pages: PdfPage[] = [];

    pages.push(titlePage(request.workbook, author, width, height));
    if (options.includeLearningObjectivesPage) pages.push(listPage("Learning Objectives", request.workbook.learningObjectives, width, height, options.marginInches, options.activityFontSizePt));
    if (options.includeDirectionsPage && request.workbook.directions.length) pages.push(listPage("Directions", request.workbook.directions, width, height, options.marginInches, options.activityFontSizePt));
    for (const activity of request.workbook.activities) pages.push(activityPage(activity, width, height, options));

    const answerKeyIncluded = request.workbook.includeAnswerKey && options.includeAnswerKey;
    const answerPages = answerKeyIncluded ? answerKeyPages(request.workbook, width, height, options) : [];
    pages.push(...answerPages);

    const bytes = buildPdf(pages, width, height);
    const now = iso(request.now ?? new Date().toISOString(), "Workbook PDF generatedAt");
    const safe = request.workbook.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "educational-workbook";
    const artifact: ProductionArtifact = Object.freeze({
      formatVersion: 1,
      id: `production-${bookId}-workbook-pdf-${Date.parse(now)}`,
      projectId: request.workbook.projectId,
      bookId,
      format: "pdf",
      mimeType: "application/pdf",
      fileName: `${safe}-interior.pdf`,
      byteLength: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      generatedAt: now,
      contentBase64: bytes.toString("base64"),
    });
    const issues = validateProductionArtifact(artifact);
    const errors = issues.filter((issue) => issue.severity === "error");
    if (errors.length) throw new Error(errors.map((issue) => issue.message).join(" "));

    return {
      artifact,
      layout: Object.freeze({
        trimWidthInches: options.trimWidthInches,
        trimHeightInches: options.trimHeightInches,
        totalPages: pages.length,
        activityPages: request.workbook.activities.length,
        answerKeyPages: answerPages.length,
        answerKeyIncluded,
      }),
    };
  }
}

interface NormalizedPdfOptions {
  readonly trimWidthInches: number;
  readonly trimHeightInches: number;
  readonly marginInches: number;
  readonly activityFontSizePt: number;
  readonly answerFontSizePt: number;
  readonly includeStudentNameLine: boolean;
  readonly includeLearningObjectivesPage: boolean;
  readonly includeDirectionsPage: boolean;
  readonly includeAnswerKey: boolean;
}

interface PdfPage { readonly commands: string; }

function normalizeOptions(input?: EducationalWorkbookPdfOptions): NormalizedPdfOptions {
  const options: NormalizedPdfOptions = {
    trimWidthInches: input?.trimWidthInches ?? 8.5,
    trimHeightInches: input?.trimHeightInches ?? 11,
    marginInches: input?.marginInches ?? 0.65,
    activityFontSizePt: input?.activityFontSizePt ?? 13,
    answerFontSizePt: input?.answerFontSizePt ?? 10,
    includeStudentNameLine: input?.includeStudentNameLine !== false,
    includeLearningObjectivesPage: input?.includeLearningObjectivesPage !== false,
    includeDirectionsPage: input?.includeDirectionsPage !== false,
    includeAnswerKey: input?.includeAnswerKey !== false,
  };
  if (!Number.isFinite(options.trimWidthInches) || options.trimWidthInches < 5 || options.trimWidthInches > 17) throw new Error("Workbook trim width must be from 5 to 17 inches.");
  if (!Number.isFinite(options.trimHeightInches) || options.trimHeightInches < 7 || options.trimHeightInches > 17) throw new Error("Workbook trim height must be from 7 to 17 inches.");
  if (!Number.isFinite(options.marginInches) || options.marginInches < 0.25 || options.marginInches > 2) throw new Error("Workbook margin must be from 0.25 to 2 inches.");
  if (!Number.isFinite(options.activityFontSizePt) || options.activityFontSizePt < 8 || options.activityFontSizePt > 36) throw new Error("Workbook activity font size must be from 8 to 36 points.");
  if (!Number.isFinite(options.answerFontSizePt) || options.answerFontSizePt < 7 || options.answerFontSizePt > 24) throw new Error("Workbook answer font size must be from 7 to 24 points.");
  return Object.freeze(options);
}

function titlePage(workbook: EducationalWorkbookPlan, author: string, width: number, height: number): PdfPage {
  const rows = [workbook.title, ...(workbook.subtitle ? [workbook.subtitle] : []), `Grade band: ${workbook.gradeBand}`, author];
  const sizes = [26, ...(workbook.subtitle ? [16] : []), 12, 13];
  const startY = height * 0.64;
  const commands = rows.map((row, index) => centeredText(row, width, startY - index * 42, sizes[index] ?? 12));
  return { commands: commands.join("\n") };
}

function listPage(title: string, items: readonly string[], width: number, height: number, marginInches: number, fontSize: number): PdfPage {
  const left = marginInches * 72;
  const right = width - left;
  let y = height - left;
  const commands: string[] = [text(title, left, y, 20)];
  y -= 38;
  const maxChars = Math.max(30, Math.floor((right - left) / (fontSize * 0.52)));
  for (const item of items) {
    const rows = wrap(`• ${item}`, maxChars);
    for (const row of rows) {
      if (y < left + 24) break;
      commands.push(text(row, left, y, fontSize));
      y -= fontSize * 1.5;
    }
    y -= fontSize * 0.55;
  }
  return { commands: commands.join("\n") };
}

function activityPage(activity: EducationalWorkbookActivityPage, width: number, height: number, options: NormalizedPdfOptions): PdfPage {
  const margin = options.marginInches * 72;
  const left = margin;
  const right = width - margin;
  let y = height - margin;
  const commands: string[] = [];
  commands.push(text(`Activity ${activity.sequence}`, left, y, 10));
  commands.push(text(`${activity.subject.replace(/-/g, " ")} • ${activity.difficulty} • ${activity.points} point${activity.points === 1 ? "" : "s"}`, left, y - 17, 8));
  y -= 50;
  if (options.includeStudentNameLine) {
    commands.push(text("Name: ____________________________________    Date: ______________", left, y, 10));
    y -= 34;
  }
  const promptMax = Math.max(28, Math.floor((right - left) / (options.activityFontSizePt * 0.52)));
  for (const row of wrap(activity.prompt, promptMax)) {
    commands.push(text(row, left, y, options.activityFontSizePt));
    y -= options.activityFontSizePt * 1.48;
  }
  y -= 16;

  if (activity.choices?.length) {
    const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    activity.choices.forEach((choice, index) => {
      const rows = wrap(`${labels[index] ?? index + 1}. ${choice}`, promptMax - 3);
      for (const row of rows) {
        commands.push(text(row, left + 12, y, options.activityFontSizePt - 1));
        y -= (options.activityFontSizePt - 1) * 1.45;
      }
      y -= 8;
    });
  }

  if (activity.kind === "true-false") {
    commands.push(text("Circle one:   True      False", left, y, options.activityFontSizePt));
    y -= 34;
  }

  if (activity.kind !== "multiple-choice" && activity.kind !== "true-false") {
    const lineSpacing = Math.max(22, options.activityFontSizePt * 1.85);
    commands.push("0.75 G 0.5 w");
    for (let lineY = y; lineY >= margin + 20; lineY -= lineSpacing) commands.push(`${fmt(left)} ${fmt(lineY)} m ${fmt(right)} ${fmt(lineY)} l S`);
    commands.push("0 G");
  }

  if (activity.standards.length) commands.push(text(`Standards: ${activity.standards.join(", ")}`, left, Math.max(18, margin - 18), 7));
  return { commands: commands.join("\n") };
}

function answerKeyPages(workbook: EducationalWorkbookPlan, width: number, height: number, options: NormalizedPdfOptions): PdfPage[] {
  if (!workbook.answerKey.length) return [];
  const margin = options.marginInches * 72;
  const left = margin;
  const right = width - margin;
  const maxChars = Math.max(42, Math.floor((right - left) / (options.answerFontSizePt * 0.5)));
  const pages: PdfPage[] = [];
  let commands: string[] = [];
  let y = 0;
  const start = () => {
    commands = [text("Answer Key", left, height - margin, 20)];
    y = height - margin - 38;
  };
  const flush = () => { pages.push({ commands: commands.join("\n") }); start(); };
  start();
  for (const entry of workbook.answerKey) {
    const explanation = entry.explanation ? ` — ${entry.explanation}` : "";
    const rows = wrap(`${entry.sequence}. ${entry.answer}${explanation}`, maxChars);
    const needed = rows.length * options.answerFontSizePt * 1.45 + 10;
    if (y - needed < margin && commands.length > 1) flush();
    for (const row of rows) {
      commands.push(text(row, left, y, options.answerFontSizePt));
      y -= options.answerFontSizePt * 1.45;
    }
    y -= 9;
  }
  if (commands.length > 1) pages.push({ commands: commands.join("\n") });
  return pages;
}

function buildPdf(pages: readonly PdfPage[], width: number, height: number): Buffer {
  if (!pages.length) throw new Error("Educational Workbook PDF requires at least one page.");
  const objects: string[] = [];
  const add = (value: string): number => { objects.push(value); return objects.length; };
  const catalog = add("");
  const pagesObject = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageRefs: number[] = [];
  for (const page of pages) {
    const stream = page.commands;
    const content = add(`<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`);
    pageRefs.push(add(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${fmt(width)} ${fmt(height)}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`;
  objects[pagesObject - 1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(out, "binary"));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "binary");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "binary");
}

function text(value: string, x: number, y: number, size: number): string {
  return `BT /F1 ${fmt(size)} Tf ${fmt(x)} ${fmt(y)} Td (${pdfText(value)}) Tj ET`;
}

function centeredText(value: string, width: number, y: number, size: number): string {
  return text(value, Math.max(36, width / 2 - value.length * size * 0.24), y, size);
}

function wrap(value: string, maxChars: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rows: string[] = [];
  let row = words.shift()!;
  for (const word of words) {
    if (`${row} ${word}`.length <= maxChars) row += ` ${word}`;
    else { rows.push(row); row = word; }
  }
  rows.push(row);
  return rows;
}

function pdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/[\u0100-\uFFFF]/g, "?");
}

function fmt(value: number): string { return Number(value.toFixed(3)).toString(); }
function required(value: string, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function iso(value: string, label: string): string { const parsed = new Date(value); if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} must be a valid timestamp.`); return parsed.toISOString(); }
