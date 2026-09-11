import { createHash } from "node:crypto";

export const MANUSCRIPT_PRODUCTION_FORMAT_VERSION = 1 as const;
export const PRODUCTION_FORMATS = ["docx", "pdf", "epub", "kdp-docx", "kdp-pdf", "kdp-epub"] as const;
export type ProductionFormat = typeof PRODUCTION_FORMATS[number];
export const FRONT_MATTER_KINDS = ["title-page", "copyright", "dedication", "epigraph", "toc"] as const;
export type FrontMatterKind = typeof FRONT_MATTER_KINDS[number];
export const BACK_MATTER_KINDS = ["author-biography", "acknowledgments", "about-the-author", "back-matter", "series-information"] as const;
export type BackMatterKind = typeof BACK_MATTER_KINDS[number];

export interface ProductionSection { readonly kind: FrontMatterKind | BackMatterKind; readonly title?: string; readonly body: string; }
export interface ProductionIllustration {
  readonly id: string;
  readonly sourceAssetId: string;
  readonly altText: string;
  readonly mimeType: "image/jpeg";
  readonly contentBase64: string;
  readonly sha256: string;
  readonly sourceAssetSha256: string;
  readonly widthPixels: number;
  readonly heightPixels: number;
  readonly dpi: number;
}
export interface ProductionChapter { readonly id: string; readonly number: number; readonly title: string; readonly scenes: readonly ProductionScene[]; }
export interface ProductionScene { readonly id: string; readonly title: string; readonly body: string; readonly illustrations?: readonly ProductionIllustration[]; }
export interface ProductionManuscript {
  readonly projectId: string; readonly bookId: string; readonly title: string; readonly subtitle?: string; readonly author: string;
  readonly chapters: readonly ProductionChapter[]; readonly frontMatter: readonly ProductionSection[]; readonly backMatter: readonly ProductionSection[];
  readonly seriesName?: string; readonly seriesNumber?: number;
}
export interface ProductionOptions {
  readonly format: ProductionFormat; readonly pageSize?: "letter" | "a4" | "6x9" | "5x8"; readonly pageNumbers?: boolean;
  readonly runningHeader?: string; readonly runningFooter?: string; readonly includeTitlePage?: boolean; readonly includeToc?: boolean;
}
export interface ProductionArtifact {
  readonly formatVersion: typeof MANUSCRIPT_PRODUCTION_FORMAT_VERSION; readonly id: string; readonly projectId: string; readonly bookId: string;
  readonly format: ProductionFormat; readonly mimeType: string; readonly fileName: string; readonly byteLength: number; readonly sha256: string;
  readonly generatedAt: string; readonly contentBase64: string; readonly pageCount?: number; readonly illustrationCount?: number;
}
export interface ProductionValidationIssue { readonly code: string; readonly severity: "error" | "warning"; readonly message: string; }

export function validateProductionManuscript(input: ProductionManuscript): void {
  required(input.projectId, "Project id"); required(input.bookId, "Book id"); required(input.title, "Book title"); required(input.author, "Author");
  if (!input.chapters.length) throw new Error("At least one chapter is required.");
  const chapterNumbers = new Set<number>(); const ids = new Set<string>(); const illustrationIds = new Set<string>();
  for (const chapter of input.chapters) {
    if (!Number.isInteger(chapter.number) || chapter.number < 1) throw new Error("Chapter number must be a positive integer.");
    if (chapterNumbers.has(chapter.number)) throw new Error(`Duplicate chapter number ${chapter.number}.`);
    chapterNumbers.add(chapter.number);
    if (ids.has(chapter.id)) throw new Error(`Duplicate chapter id ${chapter.id}.`);
    ids.add(chapter.id); required(chapter.title, "Chapter title");
    for (const scene of chapter.scenes) {
      if (ids.has(scene.id)) throw new Error(`Duplicate scene id ${scene.id}.`);
      ids.add(scene.id); required(scene.title, "Scene title");
      for (const illustration of scene.illustrations ?? []) {
        validateProductionIllustration(illustration);
        if (illustrationIds.has(illustration.id)) throw new Error(`Duplicate production illustration id ${illustration.id}.`);
        illustrationIds.add(illustration.id);
      }
    }
  }
  for (const section of [...input.frontMatter, ...input.backMatter]) { if (!section.body.trim()) throw new Error(`Production section ${section.kind} cannot be empty.`); }
  if (input.seriesNumber !== undefined && (!Number.isInteger(input.seriesNumber) || input.seriesNumber < 1)) throw new Error("Series number must be a positive integer.");
}
export function validateProductionIllustration(image: ProductionIllustration): void {
  required(image.id, "Production illustration id");
  required(image.sourceAssetId, "Production illustration source asset id");
  required(image.altText, "Production illustration alt text");
  if (image.mimeType !== "image/jpeg") throw new Error("Production illustrations must be normalized JPEG media.");
  if (!Number.isInteger(image.widthPixels) || image.widthPixels < 1 || !Number.isInteger(image.heightPixels) || image.heightPixels < 1) throw new Error("Production illustration dimensions must be positive integers.");
  if (!Number.isFinite(image.dpi) || image.dpi <= 0) throw new Error("Production illustration DPI must be positive.");
  const bytes = strictBase64(image.contentBase64, "Production illustration content");
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new Error("Production illustration does not contain a valid JPEG envelope.");
  const actualSha = createHash("sha256").update(bytes).digest("hex");
  if (digest(image.sha256, "Production illustration SHA-256") !== actualSha) throw new Error("Production illustration SHA-256 does not match its bytes.");
  digest(image.sourceAssetSha256, "Production illustration source asset SHA-256");
}
export function validateProductionOptions(options: ProductionOptions): void { if (!PRODUCTION_FORMATS.includes(options.format)) throw new Error("Unsupported production format."); if (options.pageNumbers !== undefined && typeof options.pageNumbers !== "boolean") throw new Error("pageNumbers must be boolean."); }
export function normalizeProductionManuscript(input: ProductionManuscript): ProductionManuscript {
  validateProductionManuscript(input);
  const chapters = [...input.chapters].sort((a,b)=>a.number-b.number || a.id.localeCompare(b.id)).map(c=>({
    ...c,
    title:c.title.trim(),
    scenes:c.scenes.map(s=>({
      ...s,
      title:s.title.trim(),
      body:s.body,
      ...(s.illustrations?.length ? { illustrations:Object.freeze(s.illustrations.map(i=>Object.freeze({ ...i }))) } : {}),
    })),
  }));
  return { ...input, title:input.title.trim(), author:input.author.trim(), chapters, frontMatter:input.frontMatter.map(cloneSection), backMatter:input.backMatter.map(cloneSection) };
}
export function productionIllustrationCount(manuscript: ProductionManuscript): number {
  return manuscript.chapters.reduce((total, chapter) => total + chapter.scenes.reduce((sceneTotal, scene) => sceneTotal + (scene.illustrations?.length ?? 0), 0), 0);
}
export function requiredFrontMatter(manuscript: ProductionManuscript): readonly FrontMatterKind[] { return ["title-page", "copyright"]; }
export function requiredBackMatter(): readonly BackMatterKind[] { return []; }
export function validateProductionArtifact(artifact: ProductionArtifact): ProductionValidationIssue[] {
  const issues: ProductionValidationIssue[]=[]; if (artifact.formatVersion!==MANUSCRIPT_PRODUCTION_FORMAT_VERSION) issues.push({code:"VERSION",severity:"error",message:"Unsupported production artifact version."});
  if (!artifact.contentBase64) issues.push({code:"EMPTY",severity:"error",message:"Production artifact contains no file content."});
  let bytes:Buffer; try { bytes=strictBase64(artifact.contentBase64,"Production artifact content"); } catch { issues.push({code:"BASE64",severity:"error",message:"Artifact content is not valid base64."}); return issues; }
  if (bytes.length!==artifact.byteLength) issues.push({code:"BYTE_LENGTH",severity:"error",message:"Artifact byte length does not match encoded content."});
  const expectedMime=mimeFor(artifact.format); if (artifact.mimeType!==expectedMime) issues.push({code:"MIME",severity:"error",message:"Artifact MIME type does not match its format."});
  if (!artifact.fileName.toLowerCase().endsWith(extensionFor(artifact.format))) issues.push({code:"EXTENSION",severity:"error",message:"Artifact filename extension does not match its format."});
  if (artifact.pageCount !== undefined && (!Number.isInteger(artifact.pageCount) || artifact.pageCount < 1)) issues.push({code:"PAGE_COUNT",severity:"error",message:"Artifact page count must be a positive integer when present."});
  if (artifact.illustrationCount !== undefined && (!Number.isInteger(artifact.illustrationCount) || artifact.illustrationCount < 0)) issues.push({code:"ILLUSTRATION_COUNT",severity:"error",message:"Artifact illustration count must be a non-negative integer when present."});
  return issues;
}
export function mimeFor(format: ProductionFormat): string { if(format.includes("docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; if(format.includes("pdf")) return "application/pdf"; return "application/epub+zip"; }
export function extensionFor(format: ProductionFormat): string { return format.includes("docx")?".docx":format.includes("pdf")?".pdf":".epub"; }
function required(value:string,label:string):void{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required.`)}
function cloneSection(s:ProductionSection):ProductionSection{return {...s}}
function digest(value:string,label:string):string{if(typeof value!=="string"||!/^[a-f0-9]{64}$/i.test(value))throw new Error(`${label} must be a 64-character hexadecimal digest.`);return value.toLowerCase()}
function strictBase64(value:string,label:string):Buffer{if(typeof value!=="string"||!value||value.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw new Error(`${label} must be canonical base64.`);const bytes=Buffer.from(value,"base64");if(bytes.toString("base64")!==value)throw new Error(`${label} must be canonical base64.`);return bytes}
