export const PUBLISHING_METADATA_FORMAT_VERSION = 1 as const;
export const PUBLISHING_FORMATS = ["ebook", "paperback", "hardcover"] as const;
export const AI_CONTENT_STATES = ["none", "assisted", "generated"] as const;
export type PublishingFormat = typeof PUBLISHING_FORMATS[number];
export type AiContentState = typeof AI_CONTENT_STATES[number];
export type PrimaryAudience = "general" | "children" | "teen";
export type IsbnStrategy = "not-applicable" | "kdp-free" | "owned";
export type MetadataIssueSeverity = "error" | "warning";

export interface PublishingContributor { readonly name: string; readonly role: string; }
export interface ReadingAge { readonly min: number; readonly max: number; }
export interface AiContentDisclosure { readonly text: AiContentState; readonly images: AiContentState; readonly translations: AiContentState; }
export interface PublishingMetadata {
  readonly formatVersion: typeof PUBLISHING_METADATA_FORMAT_VERSION;
  readonly projectId: string;
  readonly bookId: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly seriesName?: string;
  readonly seriesNumber?: string;
  readonly editionNumber?: string;
  readonly author: string;
  readonly contributors: readonly PublishingContributor[];
  readonly publisher?: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly categories: readonly string[];
  readonly primaryAudience: PrimaryAudience;
  readonly readingAge?: ReadingAge;
  readonly primaryMarketplace: string;
  readonly language: string;
  readonly formats: readonly PublishingFormat[];
  readonly isbnStrategy: IsbnStrategy;
  readonly isbn?: string;
  readonly lowContent: boolean;
  readonly publicationDate?: string;
  readonly aiContent: AiContentDisclosure;
  readonly updatedAt: string;
}
export interface PublishingMetadataIssue { readonly id: string; readonly field: string; readonly severity: MetadataIssueSeverity; readonly message: string; readonly remediation: string; }
export interface PublishingMetadataCompliance { readonly compliant: boolean; readonly issues: readonly PublishingMetadataIssue[]; }

export function createPublishingMetadata(input: Omit<PublishingMetadata, "formatVersion">): PublishingMetadata {
  return validatePublishingMetadata({ ...input, formatVersion: PUBLISHING_METADATA_FORMAT_VERSION });
}

export function validatePublishingMetadata(value: PublishingMetadata): PublishingMetadata {
  if (!value || typeof value !== "object" || value.formatVersion !== PUBLISHING_METADATA_FORMAT_VERSION) throw new Error("Unsupported publishing metadata format version.");
  const projectId = text(value.projectId, "Publishing metadata project id");
  const bookId = text(value.bookId, "Publishing metadata book id");
  const title = text(value.title, "Publishing title");
  const author = text(value.author, "Publishing author");
  const description = text(value.description, "Publishing description");
  if (description.length > 4000) throw new Error("Publishing description cannot exceed 4000 characters for KDP.");
  const keywords = uniqueStrings(value.keywords, "Publishing keywords");
  if (keywords.length > 7) throw new Error("KDP supports up to seven keyword phrases.");
  const categories = uniqueStrings(value.categories, "Publishing categories");
  if (categories.length > 3) throw new Error("KDP supports up to three categories.");
  if (!PUBLISHING_FORMATS.length || !Array.isArray(value.formats) || value.formats.length === 0 || value.formats.some((format) => !PUBLISHING_FORMATS.includes(format))) throw new Error("Publishing formats are invalid.");
  const formats = [...new Set(value.formats)];
  if (!["general", "children", "teen"].includes(value.primaryAudience)) throw new Error("Invalid publishing primary audience.");
  if (!["not-applicable", "kdp-free", "owned"].includes(value.isbnStrategy)) throw new Error("Invalid ISBN strategy.");
  if (value.isbn !== undefined && !/^\d{10}(?:\d{3})?$/.test(value.isbn.replace(/[-\s]/g, ""))) throw new Error("ISBN must contain 10 or 13 digits when supplied.");
  const readingAge = value.readingAge === undefined ? undefined : validateReadingAge(value.readingAge);
  const contributors = Array.isArray(value.contributors) ? value.contributors.map((item) => ({ name: text(item?.name, "Contributor name"), role: text(item?.role, "Contributor role") })) : (() => { throw new Error("Publishing contributors must be an array."); })();
  const aiContent = validateAiContent(value.aiContent);
  const updatedAt = timestamp(value.updatedAt, "Publishing metadata updatedAt");
  const publicationDate = value.publicationDate === undefined ? undefined : date(value.publicationDate, "Publishing publication date");
  return clone({
    ...value,
    projectId,
    bookId,
    title,
    author,
    description,
    keywords,
    categories,
    formats,
    contributors,
    primaryMarketplace: text(value.primaryMarketplace, "Primary marketplace"),
    language: text(value.language, "Publishing language"),
    subtitle: optional(value.subtitle),
    seriesName: optional(value.seriesName),
    seriesNumber: optional(value.seriesNumber),
    editionNumber: optional(value.editionNumber),
    publisher: optional(value.publisher),
    readingAge,
    aiContent,
    updatedAt,
    ...(publicationDate ? { publicationDate } : {}),
  });
}

export function assessPublishingMetadata(value: PublishingMetadata, context: { readonly coverTitle?: string; readonly coverAuthor?: string } = {}): PublishingMetadataCompliance {
  const metadata = validatePublishingMetadata(value);
  const issues: PublishingMetadataIssue[] = [];
  const add = (id: string, field: string, severity: MetadataIssueSeverity, message: string, remediation: string) => issues.push({ id, field, severity, message, remediation });
  if (metadata.title.length > 60) add("title-length", "title", "warning", "The title is longer than 60 characters, which KDP notes readers may skim past.", "Review whether the title can remain accurate while becoming easier to scan.");
  if (context.coverTitle !== undefined && context.coverTitle.trim() !== metadata.title) add("cover-title-match", "title", "error", "Publishing title does not exactly match the supplied cover title.", "Make the title on the cover and publishing metadata identical.");
  if (context.coverAuthor !== undefined && context.coverAuthor.trim() !== metadata.author) add("cover-author-match", "author", "error", "Publishing author does not exactly match the supplied cover author.", "Make the author name on the cover and publishing metadata identical.");
  if (metadata.primaryAudience === "children" && !metadata.readingAge) add("children-reading-age", "readingAge", "warning", "Children's metadata has no reading-age range.", "Choose the reading-age range that accurately fits the book.");
  if (metadata.readingAge && metadata.primaryAudience === "children" && metadata.readingAge.max > 12) add("children-age-range", "readingAge", "warning", "The selected children's reading age extends above the usual 0–12 children's bands.", "Confirm whether the primary audience should instead be Teen & Young Adult.");
  const print = metadata.formats.some((format) => format === "paperback" || format === "hardcover");
  if (print && !metadata.lowContent && metadata.isbnStrategy === "not-applicable") add("print-isbn", "isbnStrategy", "error", "Print publishing requires an ISBN strategy for this non-low-content book.", "Choose a KDP free ISBN or record an ISBN you own.");
  if (metadata.isbnStrategy === "owned" && !metadata.isbn) add("owned-isbn", "isbn", "error", "Owned ISBN strategy is selected but no ISBN is recorded.", "Enter the ISBN that will be used in KDP.");
  if (metadata.description.length > 0 && metadata.description.length < 50) add("description-depth", "description", "warning", "The description is unusually short for a retail detail page.", "Review whether it clearly communicates the book's premise, theme or reader promise.");
  if (/https?:\/\/|www\.|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/i.test(metadata.description)) add("description-contact", "description", "error", "The description appears to contain a URL or email address, which KDP prohibits.", "Remove URLs, email addresses and alternative ordering/contact information.");
  if (/\b(?:buy now|on sale|free today|limited time|bestseller|best-selling|#1)\b/i.test(metadata.description)) add("description-promotion", "description", "error", "The description appears to contain promotional, price/rank or time-sensitive language prohibited by KDP metadata rules.", "Describe the book itself rather than price, rank, availability or promotions.");
  if (/\b(?:review|testimonial)\b/i.test(metadata.description)) add("description-reviews", "description", "warning", "The description may contain review/testimonial language, which KDP does not accept in the description field.", "Remove reviews, testimonials and requests for reviews.");
  for (const keyword of metadata.keywords) {
    if (/<[^>]+>|[“”"]|\b(?:free|bestseller|best-selling|kindle unlimited|kdp select)\b/i.test(keyword)) add(`keyword-${issues.length + 1}`, "keywords", "error", `Keyword phrase "${keyword}" contains formatting or promotional/program language KDP advises against.`, "Use accurate reader-search language describing the book's setting, characters, themes, tone or subject.");
  }
  if (metadata.categories.length === 0) add("categories-empty", "categories", "warning", "No retail categories are selected.", "Choose up to three accurate categories for the primary marketplace.");
  if (metadata.keywords.length === 0) add("keywords-empty", "keywords", "warning", "No optional search keywords are recorded.", "Add relevant search phrases if they improve discoverability without repeating or misleading metadata.");
  return { compliant: !issues.some((issue) => issue.severity === "error"), issues };
}

export function requiresKdpAiDisclosure(metadata: PublishingMetadata): boolean {
  const value = validatePublishingMetadata(metadata);
  return Object.values(value.aiContent).some((state) => state === "generated");
}

function validateAiContent(value: AiContentDisclosure): AiContentDisclosure {
  if (!value || typeof value !== "object") throw new Error("AI content disclosure is required.");
  for (const state of [value.text, value.images, value.translations]) if (!AI_CONTENT_STATES.includes(state)) throw new Error("Invalid AI content disclosure state.");
  return { text: value.text, images: value.images, translations: value.translations };
}
function validateReadingAge(value: ReadingAge): ReadingAge {
  if (!Number.isInteger(value.min) || !Number.isInteger(value.max) || value.min < 0 || value.max > 17 || value.min > value.max) throw new Error("Reading age must be a valid 0–17 range.");
  return { min: value.min, max: value.max };
}
function uniqueStrings(value: unknown, label: string): string[] { if (!Array.isArray(value)) throw new Error(`${label} must be an array.`); const items = value.map((item) => text(item, label)); return [...new Set(items)]; }
function text(value: unknown, label: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`); return value.trim(); }
function optional(value: unknown): string | undefined { if (value === undefined || value === null || value === "") return undefined; if (typeof value !== "string") throw new Error("Optional publishing metadata fields must be strings."); return value.trim() || undefined; }
function timestamp(value: unknown, label: string): string { const textValue = text(value, label); if (Number.isNaN(Date.parse(textValue))) throw new Error(`${label} must be a valid timestamp.`); return new Date(Date.parse(textValue)).toISOString(); }
function date(value: unknown, label: string): string { const textValue = text(value, label); if (!/^\d{4}-\d{2}-\d{2}$/.test(textValue) || Number.isNaN(Date.parse(`${textValue}T00:00:00Z`))) throw new Error(`${label} must use YYYY-MM-DD.`); return textValue; }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
