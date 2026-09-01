import { createHash } from "node:crypto";
import type { GuidedJournalPlan } from "../domain/guided-journal";
import { planJournalProductionLayout, validateJournalInteriorFormat, type JournalInteriorFormat, type JournalProductionLayout } from "../domain/guided-journal-layout";
import { validateProductionArtifact, type ProductionArtifact } from "../domain/manuscript-production";

export interface RenderGuidedJournalPdfRequest {
  readonly journal: GuidedJournalPlan;
  readonly bookId: string;
  readonly author: string;
  readonly copyrightHolder?: string;
  readonly introduction?: readonly string[];
  readonly closing?: readonly string[];
  readonly format: JournalInteriorFormat;
  readonly now?: string;
}

export interface GuidedJournalPdfResult {
  readonly artifact: ProductionArtifact;
  readonly layout: JournalProductionLayout;
}

/** Generates a deterministic, real PDF interior from the journal production plan. */
export class GuidedJournalProductionService {
  renderPdf(request: RenderGuidedJournalPdfRequest): GuidedJournalPdfResult {
    validateJournalInteriorFormat(request.format);
    const author = required(request.author, "Journal author");
    const bookId = required(request.bookId, "Journal book id");
    const layout = planJournalProductionLayout(request.journal, request.format);
    const pages = buildPages(request, layout, author);
    if (pages.length !== layout.totalPages) throw new Error(`Journal renderer produced ${pages.length} pages but production layout requires ${layout.totalPages}.`);
    const bytes = buildPdf(pages, request.format.trimWidthInches * 72, request.format.trimHeightInches * 72);
    const now = new Date(request.now ?? new Date().toISOString()).toISOString();
    const safe = request.journal.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "guided-journal";
    const artifact: ProductionArtifact = Object.freeze({
      formatVersion: 1,
      id: `production-${bookId}-kdp-pdf-${Date.parse(now)}`,
      projectId: request.journal.projectId,
      bookId,
      format: "kdp-pdf",
      mimeType: "application/pdf",
      fileName: `${safe}-interior.pdf`,
      byteLength: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      generatedAt: now,
      contentBase64: bytes.toString("base64"),
    });
    const issues = validateProductionArtifact(artifact);
    if (issues.some((issue) => issue.severity === "error")) throw new Error(issues.map((issue) => issue.message).join(" "));
    return { artifact, layout };
  }
}

interface PdfPage { readonly commands: string; }

function buildPages(request: RenderGuidedJournalPdfRequest, layout: JournalProductionLayout, author: string): PdfPage[] {
  const f = request.format;
  const width = f.trimWidthInches * 72;
  const height = f.trimHeightInches * 72;
  const pages: PdfPage[] = [];
  if (f.includeTitlePage) pages.push(textPage(width, height, request.journal.title, request.journal.subtitle, author, f));
  if (f.includeCopyrightPage) {
    const holder = required(request.copyrightHolder ?? author, "Copyright holder");
    pages.push(centeredLines(width, height, [`Copyright ${new Date(request.now ?? new Date().toISOString()).getUTCFullYear()} ${holder}`, "All rights reserved."], f.responseFontSizePt));
  }
  const introductions = request.introduction ?? [];
  for (let i = 0; i < f.includeIntroductionPages; i++) pages.push(bodyPage(width, height, introductions[i] ?? "", f));

  for (const prompt of request.journal.prompts) {
    pages.push(promptPage(width, height, prompt.prompt, f.showCategoryLabel ? prompt.category : undefined, f));
    for (let i = 0; i < f.responsePagesPerPrompt; i++) pages.push(responsePage(width, height, prompt.prompt, f, i + 1));
  }

  const closing = request.closing ?? [];
  for (let i = 0; i < f.includeClosingPages; i++) pages.push(bodyPage(width, height, closing[i] ?? "", f));
  while (pages.length < layout.totalPages) pages.push({ commands: "" });
  return pages;
}

function textPage(width: number, height: number, title: string, subtitle: string | undefined, author: string, f: JournalInteriorFormat): PdfPage {
  const lines = [title, ...(subtitle?.trim() ? [subtitle.trim()] : []), author];
  return centeredLines(width, height, lines, Math.max(f.promptFontSizePt, 18));
}

function promptPage(width: number, height: number, prompt: string, category: string | undefined, f: JournalInteriorFormat): PdfPage {
  const maxChars = Math.max(24, Math.floor((width - (f.margins.insideInches + f.margins.outsideInches) * 72) / (f.promptFontSizePt * 0.52)));
  const lines = wrap(prompt, maxChars);
  const x = alignedX(width, f, lines, f.promptFontSizePt);
  const totalHeight = lines.length * (f.promptFontSizePt * 1.45);
  let y = height / 2 + totalHeight / 2;
  const commands: string[] = [];
  if (category) {
    commands.push(`BT /F1 ${Math.max(8, f.responseFontSizePt)} Tf ${fmt(width / 2 - category.length * f.responseFontSizePt * 0.22)} ${fmt(y + 40)} Td (${pdfText(category.toLocaleUpperCase())}) Tj ET`);
  }
  for (let i = 0; i < lines.length; i++) commands.push(`BT /F1 ${fmt(f.promptFontSizePt)} Tf ${fmt(x[i])} ${fmt(y - i * f.promptFontSizePt * 1.45)} Td (${pdfText(lines[i])}) Tj ET`);
  return { commands: commands.join("\n") };
}

function responsePage(width: number, height: number, prompt: string, f: JournalInteriorFormat, responseIndex: number): PdfPage {
  const left = f.margins.insideInches * 72;
  const right = width - f.margins.outsideInches * 72;
  const top = height - f.margins.topInches * 72;
  const bottom = f.margins.bottomInches * 72;
  const commands: string[] = [];
  if (f.pageStyle === "guided-response") {
    const header = wrap(prompt, Math.max(30, Math.floor((right - left) / (f.responseFontSizePt * 0.5)))).slice(0, 2);
    let y = top;
    for (const line of header) { commands.push(`BT /F1 ${fmt(f.responseFontSizePt)} Tf ${fmt(left)} ${fmt(y)} Td (${pdfText(line)}) Tj ET`); y -= f.responseFontSizePt * 1.4; }
    commands.push(lines(left, right, y - 12, bottom, f.lineSpacingInches * 72, 0.55));
  } else if (f.pageStyle === "lined" || f.pageStyle === "lightly-lined") {
    commands.push(lines(left, right, top, bottom, f.lineSpacingInches * 72, f.pageStyle === "lightly-lined" ? 0.82 : 0.55));
  } else if (f.pageStyle === "dot-grid") {
    commands.push(dotGrid(left, right, top, bottom, f.dotSpacingInches * 72));
  }
  if (f.showPageNumbers) commands.push(`BT /F1 8 Tf ${fmt(width / 2 - 4)} ${fmt(Math.max(12, bottom - 18))} Td (${responseIndex}) Tj ET`);
  return { commands: commands.filter(Boolean).join("\n") };
}

function bodyPage(width: number, height: number, text: string, f: JournalInteriorFormat): PdfPage {
  if (!text.trim()) return { commands: "" };
  const left = f.margins.insideInches * 72;
  const top = height - f.margins.topInches * 72;
  const maxChars = Math.max(30, Math.floor((width - (f.margins.insideInches + f.margins.outsideInches) * 72) / (f.responseFontSizePt * 0.5)));
  const rows = text.split(/\r?\n/).flatMap((paragraph) => wrap(paragraph, maxChars));
  return { commands: rows.map((row, i) => `BT /F1 ${fmt(f.responseFontSizePt)} Tf ${fmt(left)} ${fmt(top - i * f.responseFontSizePt * 1.45)} Td (${pdfText(row)}) Tj ET`).join("\n") };
}

function centeredLines(width: number, height: number, rows: readonly string[], size: number): PdfPage {
  const lineHeight = size * 1.5;
  const start = height / 2 + ((rows.length - 1) * lineHeight) / 2;
  return { commands: rows.map((row, i) => `BT /F1 ${fmt(size)} Tf ${fmt(Math.max(36, width / 2 - row.length * size * 0.24))} ${fmt(start - i * lineHeight)} Td (${pdfText(row)}) Tj ET`).join("\n") };
}

function lines(left: number, right: number, top: number, bottom: number, spacing: number, gray: number): string {
  const out = [`${fmt(gray)} G 0.35 w`];
  for (let y = top; y >= bottom; y -= spacing) out.push(`${fmt(left)} ${fmt(y)} m ${fmt(right)} ${fmt(y)} l S`);
  out.push("0 G");
  return out.join("\n");
}

function dotGrid(left: number, right: number, top: number, bottom: number, spacing: number): string {
  const out = ["0.65 g"];
  for (let y = top; y >= bottom; y -= spacing) for (let x = left; x <= right; x += spacing) out.push(`${fmt(x)} ${fmt(y)} 0.8 0.8 re f`);
  out.push("0 g");
  return out.join("\n");
}

function alignedX(width: number, f: JournalInteriorFormat, rows: readonly string[], size: number): number[] {
  const left = f.margins.insideInches * 72;
  const right = width - f.margins.outsideInches * 72;
  return rows.map((row) => {
    const estimate = row.length * size * 0.5;
    if (f.promptAlignment === "left") return left;
    if (f.promptAlignment === "right") return Math.max(left, right - estimate);
    return Math.max(left, (width - estimate) / 2);
  });
}

function buildPdf(pages: readonly PdfPage[], width: number, height: number): Buffer {
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
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(out, "binary")); out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(out, "binary");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "binary");
}

function wrap(value: string, max: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rows: string[] = [];
  let row = words.shift()!;
  for (const word of words) { if (`${row} ${word}`.length <= max) row += ` ${word}`; else { rows.push(row); row = word; } }
  rows.push(row);
  return rows;
}
function pdfText(value: string): string { return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\u0000-\u001f]/g, " "); }
function fmt(value: number): string { return Number(value.toFixed(3)).toString(); }
function required(value: string, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
