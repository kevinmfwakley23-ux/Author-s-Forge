import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import {
  addWorkspaceBook,
  addWorkspaceChapter,
  addWorkspaceScene,
  createWorkspaceBook,
  saveSceneContent,
  setActiveBook,
  type BookKind,
  type StudioWorkspaceState,
} from "../domain/studio-workspace";

export const MANUSCRIPT_IMPORT_FORMAT_VERSION = 1 as const;
export const MANUSCRIPT_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
const DOCX_XML_MAX_BYTES = 16 * 1024 * 1024;

export type ManuscriptImportFormat = "docx" | "text" | "markdown";

export interface ManuscriptImportScenePreview {
  readonly number: number;
  readonly title: string;
  readonly content: string;
  readonly wordCount: number;
}

export interface ManuscriptImportChapterPreview {
  readonly number: number;
  readonly title: string;
  readonly scenes: readonly ManuscriptImportScenePreview[];
  readonly wordCount: number;
}

export interface ManuscriptImportPreview {
  readonly formatVersion: typeof MANUSCRIPT_IMPORT_FORMAT_VERSION;
  readonly fileName: string;
  readonly format: ManuscriptImportFormat;
  readonly sourceBytes: number;
  readonly sourceSha256: string;
  readonly suggestedBookTitle: string;
  readonly chapterCount: number;
  readonly sceneCount: number;
  readonly wordCount: number;
  readonly warnings: readonly string[];
  readonly chapters: readonly ManuscriptImportChapterPreview[];
}

export interface PreviewManuscriptImportInput {
  readonly fileName: string;
  readonly dataBase64: string;
  readonly bookTitle?: string;
}

export interface ApplyManuscriptImportInput {
  readonly workspace: StudioWorkspaceState;
  readonly preview: ManuscriptImportPreview;
  readonly bookId?: string;
  readonly title?: string;
  readonly kind?: BookKind;
  readonly description?: string;
  readonly now?: string;
}

interface SourceBlock {
  readonly text: string;
  readonly headingLevel?: number;
  readonly sceneBreak?: boolean;
}
interface MutableScene { title: string; paragraphs: string[]; }
interface MutableChapter { title: string; scenes: MutableScene[]; }

export function previewManuscriptImport(input: PreviewManuscriptImportInput): ManuscriptImportPreview {
  const fileName = requiredFileName(input.fileName);
  const bytes = decodeBase64(input.dataBase64);
  if (!bytes.length) throw new Error("Manuscript import file is empty.");
  if (bytes.length > MANUSCRIPT_IMPORT_MAX_BYTES) throw new Error(`Manuscript import exceeds the ${formatBytes(MANUSCRIPT_IMPORT_MAX_BYTES)} source-file limit.`);

  const format = formatFromFileName(fileName);
  const warnings: string[] = [];
  const blocks = format === "docx" ? blocksFromDocx(bytes) : blocksFromText(bytes, format === "markdown");
  const chapters = structureBlocks(blocks, warnings).map((chapter, chapterIndex): ManuscriptImportChapterPreview => {
    const scenes = chapter.scenes.map((scene, sceneIndex): ManuscriptImportScenePreview => {
      const content = scene.paragraphs.join("\n\n").trim();
      return { number: sceneIndex + 1, title: scene.title || `Scene ${sceneIndex + 1}`, content, wordCount: countWords(content) };
    });
    return {
      number: chapterIndex + 1,
      title: chapter.title || `Chapter ${chapterIndex + 1}`,
      scenes,
      wordCount: scenes.reduce((sum, scene) => sum + scene.wordCount, 0),
    };
  });
  const wordCount = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);
  if (!wordCount) warnings.push("No manuscript prose was detected. Review the preview before importing this structure.");
  if (chapters.length === 1 && chapters[0]?.title === "Imported Manuscript") warnings.push("No explicit chapter headings were detected, so Forge preserved the manuscript as one chapter.");

  return {
    formatVersion: MANUSCRIPT_IMPORT_FORMAT_VERSION,
    fileName,
    format,
    sourceBytes: bytes.length,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    suggestedBookTitle: optionalText(input.bookTitle, 240) || titleFromFileName(fileName),
    chapterCount: chapters.length,
    sceneCount: chapters.reduce((sum, chapter) => sum + chapter.scenes.length, 0),
    wordCount,
    warnings: [...new Set(warnings)],
    chapters,
  };
}

export function applyManuscriptImport(input: ApplyManuscriptImportInput): { workspace: StudioWorkspaceState; importedBookId: string } {
  const preview = validatePreview(input.preview);
  const title = optionalText(input.title, 240) || preview.suggestedBookTitle;
  const bookId = optionalIdentifier(input.bookId) || `${slug(title)}-${preview.sourceSha256.slice(0, 8)}`;
  const now = input.now ?? new Date().toISOString();
  const provenance = `Imported from ${preview.fileName} (${preview.format.toUpperCase()}); source SHA-256 ${preview.sourceSha256}; ${preview.chapterCount} chapter(s), ${preview.sceneCount} scene(s), ${preview.wordCount} word(s) detected.`;
  const authorDescription = String(input.description ?? "").trim();

  let workspace = addWorkspaceBook(input.workspace, createWorkspaceBook({
    id: bookId,
    title,
    kind: input.kind ?? "novel",
    description: authorDescription ? `${authorDescription}\n\n${provenance}` : provenance,
    now,
  }));

  for (const chapter of preview.chapters) {
    const chapterId = `${bookId}-chapter-${chapter.number}`;
    workspace = addWorkspaceChapter(workspace, bookId, {
      id: chapterId,
      number: chapter.number,
      title: chapter.title,
      synopsis: `Imported from ${preview.fileName}.`,
      now,
    });
    for (const scene of chapter.scenes) {
      const sceneId = `${chapterId}-scene-${scene.number}`;
      workspace = addWorkspaceScene(workspace, bookId, chapterId, {
        id: sceneId,
        number: scene.number,
        title: scene.title,
        synopsis: `Imported manuscript scene from ${preview.fileName}.`,
        now,
      });
      workspace = saveSceneContent(workspace, bookId, chapterId, sceneId, scene.content, now);
    }
  }
  return { workspace: setActiveBook(workspace, bookId), importedBookId: bookId };
}

function structureBlocks(blocks: readonly SourceBlock[], warnings: string[]): MutableChapter[] {
  const meaningful = blocks.filter((block) => block.text.trim() || block.sceneBreak);
  if (!meaningful.length) return [{ title: "Imported Manuscript", scenes: [{ title: "Scene 1", paragraphs: [] }] }];

  const chapters: MutableChapter[] = [];
  let prefix: string[] = [];
  const startChapter = (title: string): MutableChapter => {
    const chapter: MutableChapter = { title: cleanHeading(title), scenes: [{ title: "Scene 1", paragraphs: [] }] };
    chapters.push(chapter);
    return chapter;
  };

  for (const block of meaningful) {
    const text = block.text.trim();
    if (isChapterHeading(block)) {
      const chapter = startChapter(text);
      if (prefix.length) {
        chapter.scenes[0].paragraphs.push(...prefix);
        warnings.push("Content before the first detected chapter heading was preserved at the start of the first imported chapter.");
        prefix = [];
      }
      continue;
    }
    if (!chapters.length) {
      if (!block.sceneBreak) prefix.push(text);
      continue;
    }

    const active = chapters[chapters.length - 1];
    if (block.sceneBreak) {
      const last = active.scenes[active.scenes.length - 1];
      if (last.paragraphs.length) active.scenes.push({ title: `Scene ${active.scenes.length + 1}`, paragraphs: [] });
      continue;
    }
    active.scenes[active.scenes.length - 1].paragraphs.push(text);
  }

  if (!chapters.length) {
    startChapter("Imported Manuscript").scenes[0].paragraphs.push(...prefix);
  } else if (prefix.length) {
    chapters[0].scenes[0].paragraphs.unshift(...prefix);
    warnings.push("Content before the first detected chapter heading was preserved at the start of the first imported chapter.");
  }
  for (const chapter of chapters) {
    while (chapter.scenes.length > 1 && !chapter.scenes[chapter.scenes.length - 1].paragraphs.length) chapter.scenes.pop();
  }
  return chapters;
}

function blocksFromText(bytes: Buffer, markdown: boolean): SourceBlock[] {
  let source: string;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("Text manuscript must use UTF-8 encoding."); }
  source = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks: SourceBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    const text = paragraph.join("\n").trim();
    if (text) blocks.push({ text });
    paragraph = [];
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line) { flush(); continue; }
    const markdownHeading = markdown ? line.match(/^(#{1,6})\s+(.+?)\s*#*$/) : null;
    if (markdownHeading) {
      flush();
      blocks.push({ text: markdownHeading[2].trim(), headingLevel: markdownHeading[1].length });
      continue;
    }
    if (isSceneBreakText(line)) {
      flush();
      blocks.push({ text: line, sceneBreak: true });
      continue;
    }
    if (looksLikeChapterHeading(line)) {
      flush();
      blocks.push({ text: line, headingLevel: 1 });
      continue;
    }
    paragraph.push(rawLine.trimEnd());
  }
  flush();
  return blocks;
}

function blocksFromDocx(bytes: Buffer): SourceBlock[] {
  const xml = extractZipEntry(bytes, "word/document.xml");
  let source: string;
  try { source = new TextDecoder("utf-8", { fatal: true }).decode(xml); }
  catch { throw new Error("DOCX document.xml is not valid UTF-8 XML."); }

  const blocks: SourceBlock[] = [];
  const paragraphPattern = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/gi;
  let paragraphMatch: RegExpExecArray | null;
  while ((paragraphMatch = paragraphPattern.exec(source))) {
    const inner = paragraphMatch[1];
    const styleMatch = inner.match(/<w:pStyle\b[^>]*\bw:val=(?:"([^"]+)"|'([^']+)')[^>]*\/?\s*>/i);
    const style = (styleMatch?.[1] ?? styleMatch?.[2] ?? "").replace(/[\s_-]+/g, "").toLowerCase();
    const headingLevel = style.match(/^heading([1-6])$/)?.[1];
    const tokenPattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/?\s*>|<w:(?:br|cr)\b[^>]*\/?\s*>/gi;
    let tokenMatch: RegExpExecArray | null;
    let text = "";
    while ((tokenMatch = tokenPattern.exec(inner))) {
      if (tokenMatch[1] !== undefined) text += decodeXml(tokenMatch[1]);
      else if (/^<w:tab/i.test(tokenMatch[0])) text += "\t";
      else text += "\n";
    }
    text = text.replace(/[ \t]+\n/g, "\n").trim();
    if (!text) continue;
    blocks.push({
      text,
      ...(headingLevel ? { headingLevel: Number(headingLevel) } : looksLikeChapterHeading(text) ? { headingLevel: 1 } : {}),
      ...(isSceneBreakText(text) ? { sceneBreak: true } : {}),
    });
  }
  if (!blocks.length) throw new Error("DOCX contains no readable manuscript paragraphs in word/document.xml.");
  return blocks;
}

function extractZipEntry(zip: Buffer, wantedName: string): Buffer {
  if (zip.length < 22) throw new Error("DOCX is not a valid ZIP package.");
  const eocd = findEndOfCentralDirectory(zip);
  const disk = zip.readUInt16LE(eocd + 4);
  const centralDisk = zip.readUInt16LE(eocd + 6);
  const entriesOnDisk = zip.readUInt16LE(eocd + 8);
  const totalEntries = zip.readUInt16LE(eocd + 10);
  const centralSize = zip.readUInt32LE(eocd + 12);
  const centralOffset = zip.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) throw new Error("Multi-disk DOCX packages are not supported.");
  if (centralOffset + centralSize > zip.length) throw new Error("DOCX central directory is corrupt.");

  let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > zip.length || zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error("DOCX central directory entry is corrupt.");
    const flags = zip.readUInt16LE(cursor + 8);
    const compression = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20);
    const uncompressedSize = zip.readUInt32LE(cursor + 24);
    const fileNameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > zip.length) throw new Error("DOCX central directory filename is corrupt.");
    const name = zip.subarray(nameStart, nameEnd).toString("utf8");

    if (name === wantedName) {
      if (flags & 0x0001) throw new Error("Encrypted DOCX files are not supported.");
      if (uncompressedSize > DOCX_XML_MAX_BYTES) throw new Error("DOCX manuscript XML exceeds the safe extraction limit.");
      if (localOffset + 30 > zip.length || zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("DOCX local file header is corrupt.");
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > zip.length) throw new Error("DOCX compressed manuscript entry is truncated.");
      const compressed = zip.subarray(dataStart, dataEnd);
      let extracted: Buffer;
      if (compression === 0) extracted = Buffer.from(compressed);
      else if (compression === 8) extracted = inflateRawSync(compressed, { maxOutputLength: DOCX_XML_MAX_BYTES });
      else throw new Error(`DOCX compression method ${compression} is not supported.`);
      if (extracted.length > DOCX_XML_MAX_BYTES) throw new Error("DOCX manuscript XML exceeds the safe extraction limit.");
      return extracted;
    }
    cursor = nameEnd + extraLength + commentLength;
  }
  throw new Error("DOCX does not contain word/document.xml.");
}

function findEndOfCentralDirectory(zip: Buffer): number {
  const minimum = Math.max(0, zip.length - 65_557);
  for (let offset = zip.length - 22; offset >= minimum; offset -= 1) {
    if (zip.readUInt32LE(offset) !== 0x06054b50) continue;
    const commentLength = zip.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === zip.length) return offset;
  }
  throw new Error("DOCX ZIP end-of-central-directory record was not found.");
}

function isChapterHeading(block: SourceBlock): boolean { return block.headingLevel === 1 || looksLikeChapterHeading(block.text); }
function looksLikeChapterHeading(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > 180) return false;
  if (/^(?:prologue|epilogue|preface|introduction|afterword|acknowledg(?:e)?ments?)$/i.test(text)) return true;
  const number = "(?:\\d{1,4}|[ivxlcdm]{1,12}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)";
  return new RegExp(`^(?:chapter|part|book)\\s+${number}(?:\\s*$|\\s*[:.\\-–—]\\s*.+$|\\s+.+$)`, "i").test(text);
}
function isSceneBreakText(value: string): boolean { return /^(?:\*\s*\*\s*\*|#(?:\s*#){0,2}|-{3,}|—\s*—\s*—|•\s*•\s*•)$/.test(value.trim()); }
function cleanHeading(value: string): string { return value.replace(/^#{1,6}\s+/, "").replace(/\s+#{1,6}$/, "").trim().slice(0, 240) || "Imported Chapter"; }

function decodeBase64(value: unknown): Buffer {
  if (typeof value !== "string" || !value.trim()) throw new Error("Manuscript file data is required.");
  const compact = value.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact) || compact.length % 4 === 1) throw new Error("Manuscript file data is not valid base64.");
  const bytes = Buffer.from(compact, "base64");
  if (bytes.toString("base64").replace(/=+$/, "") !== compact.replace(/=+$/, "")) throw new Error("Manuscript file data is not valid base64.");
  return bytes;
}

function formatFromFileName(fileName: string): ManuscriptImportFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".txt")) return "text";
  throw new Error("Unsupported manuscript format. Forge currently imports .docx, .txt, .md, and .markdown files.");
}
function requiredFileName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Manuscript filename is required.");
  const name = value.trim();
  if (!name || name.length > 260 || /[\\/\u0000-\u001f]/.test(name)) throw new Error("Manuscript filename is invalid.");
  return name;
}
function titleFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(?:docx|txt|md|markdown)$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "Imported Manuscript").slice(0, 240);
}
function optionalText(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("Book title must be text.");
  const text = value.trim();
  if (!text) return undefined;
  if (text.length > max) throw new Error(`Book title exceeds ${max} characters.`);
  return text;
}
function optionalIdentifier(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("Imported book id must be text.");
  const id = value.trim();
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(id)) throw new Error("Imported book id must use only letters, numbers, underscores, or hyphens.");
  return id;
}
function slug(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  return normalized || "imported-manuscript";
}

function validatePreview(value: ManuscriptImportPreview): ManuscriptImportPreview {
  if (!value || value.formatVersion !== MANUSCRIPT_IMPORT_FORMAT_VERSION) throw new Error("Unsupported manuscript import preview.");
  if (!Array.isArray(value.chapters) || value.chapterCount !== value.chapters.length || value.chapterCount < 1) throw new Error("Manuscript import preview has invalid chapter structure.");
  if (!/^[a-f0-9]{64}$/.test(value.sourceSha256)) throw new Error("Manuscript import preview has invalid source provenance.");
  for (const chapter of value.chapters) {
    if (!Number.isInteger(chapter.number) || chapter.number < 1 || !chapter.title.trim() || !Array.isArray(chapter.scenes) || !chapter.scenes.length) throw new Error("Manuscript import preview has invalid chapter data.");
    for (const scene of chapter.scenes) {
      if (!Number.isInteger(scene.number) || scene.number < 1 || !scene.title.trim() || typeof scene.content !== "string") throw new Error("Manuscript import preview has invalid scene data.");
    }
  }
  return value;
}

function decodeXml(value: string): string {
  return value.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (match, numeric: string | undefined, named: string | undefined) => {
    if (numeric) {
      const code = numeric[0].toLowerCase() === "x" ? Number.parseInt(numeric.slice(1), 16) : Number.parseInt(numeric, 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[String(named).toLowerCase()] ?? match;
  });
}
function countWords(value: string): number { return value.trim() ? value.trim().split(/\s+/u).length : 0; }
function formatBytes(value: number): string { return `${Math.round(value / 1024 / 1024)} MiB`; }
