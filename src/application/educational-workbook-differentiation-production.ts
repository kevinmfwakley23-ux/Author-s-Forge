import { createHash } from "node:crypto";
import type { EducationalDifferentiationPack } from "../domain/educational-workbook-differentiation";
import { validateEducationalDifferentiationPack } from "../domain/educational-workbook-differentiation";
import { validateProductionArtifact, type ProductionArtifact } from "../domain/manuscript-production";

export interface EducationalDifferentiationTeacherGuideResult {
  readonly artifact: ProductionArtifact;
  readonly totalPages: number;
}

export class EducationalWorkbookDifferentiationProductionService {
  renderTeacherGuide(input: { readonly pack: EducationalDifferentiationPack; readonly bookId: string; readonly author: string; readonly now?: string }): EducationalDifferentiationTeacherGuideResult {
    validateEducationalDifferentiationPack(input.pack);
    const bookId = required(input.bookId, "Teacher guide book id");
    const author = required(input.author, "Teacher guide author");
    const pages: string[] = [];
    pages.push(page([
      line(input.pack.title, 26),
      line("Differentiation Teacher Guide", 18),
      line(`Grade band: ${input.pack.gradeBand}`, 12),
      line(`Prepared by: ${author}`, 12),
      gap(),
      line("Learning objectives", 16),
      ...input.pack.learningObjectives.map((item) => bullet(item)),
      ...(input.pack.standards.length ? [gap(), line("Author-supplied standards/framework identifiers", 14), ...input.pack.standards.map((item) => bullet(item))] : []),
      gap(),
      line("Use note", 14),
      paragraph("These tiers are activity-bank difficulty groupings, not diagnoses or student placements. Use learner evidence and professional judgment to decide when support or extension is appropriate. Forge does not independently certify standards alignment."),
    ]));
    for (const variant of input.pack.variants) {
      pages.push(page([
        line(variant.label, 22),
        line(`Workbook edition: ${variant.workbookId}`, 11),
        line(`Activity difficulty: ${variant.difficulty}`, 11),
        gap(),
        line("Learner supports", 15),
        ...variant.learnerSupports.map((item) => bullet(item)),
        gap(),
        line("Teacher notes", 15),
        ...variant.teacherNotes.map((item) => bullet(item)),
      ]));
    }
    const bytes = buildPdf(pages, 612, 792);
    const now = iso(input.now ?? new Date().toISOString(), "Teacher guide generatedAt");
    const safe = input.pack.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "educational-differentiation";
    const artifact: ProductionArtifact = Object.freeze({
      formatVersion: 1,
      id: `production-${bookId}-differentiation-guide-${Date.parse(now)}`,
      projectId: input.pack.projectId,
      bookId,
      format: "pdf",
      mimeType: "application/pdf",
      fileName: `${safe}-teacher-guide.pdf`,
      byteLength: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      generatedAt: now,
      contentBase64: bytes.toString("base64"),
    });
    const errors = validateProductionArtifact(artifact).filter((issue) => issue.severity === "error");
    if (errors.length) throw new Error(errors.map((issue) => issue.message).join(" "));
    return Object.freeze({ artifact, totalPages: pages.length });
  }
}

type TextCommand = { readonly text?: string; readonly size?: number; readonly gap?: number };
function line(textValue: string, size: number): TextCommand { return { text: required(textValue, "Teacher guide text"), size }; }
function paragraph(textValue: string): TextCommand { return { text: required(textValue, "Teacher guide paragraph"), size: 10 }; }
function bullet(textValue: string): TextCommand { return { text: `- ${required(textValue, "Teacher guide bullet")}`, size: 10 }; }
function gap(): TextCommand { return { gap: 12 }; }
function page(commands: readonly TextCommand[]): string {
  let y = 742;
  const output: string[] = [];
  for (const command of commands) {
    if (command.gap) { y -= command.gap; continue; }
    const size = command.size ?? 10;
    for (const row of wrap(command.text ?? "", Math.max(38, Math.floor(520 / (size * 0.5))))) {
      if (y < 44) break;
      output.push(text(row, 46, y, size));
      y -= size * 1.45;
    }
    y -= Math.max(4, size * 0.35);
  }
  return output.join("\n");
}
function buildPdf(pages: readonly string[], width: number, height: number): Buffer {
  if (!pages.length) throw new Error("Teacher guide PDF requires at least one page.");
  const objects: string[] = [];
  const add = (value: string): number => { objects.push(value); return objects.length; };
  const catalog = add("");
  const pagesObject = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageRefs: number[] = [];
  for (const stream of pages) {
    const content = add(`<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`);
    pageRefs.push(add(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
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
function text(value: string, x: number, y: number, size: number): string { return `BT /F1 ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`; }
function wrap(value: string, maxChars: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rows: string[] = [];
  let row = words.shift()!;
  for (const word of words) { if (`${row} ${word}`.length <= maxChars) row += ` ${word}`; else { rows.push(row); row = word; } }
  rows.push(row);
  return rows;
}
function pdfText(value: string): string { return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\u0000-\u001f]/g, " ").replace(/[\u0100-\uFFFF]/g, "?"); }
function required(value: string, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function iso(value: string, label: string): string { const parsed = new Date(value); if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} must be a valid timestamp.`); return parsed.toISOString(); }
