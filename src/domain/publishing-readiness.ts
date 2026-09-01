export const PUBLISHING_READINESS_FORMAT_VERSION = 1 as const;
export type ReadinessStatus = "passed" | "attention";
export type ReadinessSeverity = "error" | "warning";
export type ReadinessCategory = "manuscript" | "cover" | "metadata" | "formatting" | "images" | "table-of-contents" | "pagination" | "production";
export type PublishingReleaseFormat = "ebook" | "paperback" | "hardcover";
export interface ReadinessCheck { readonly id: string; readonly category: ReadinessCategory; readonly label: string; readonly status: ReadinessStatus; readonly severity: ReadinessSeverity; readonly message: string; readonly remediation?: string; }
export interface PublishingReadinessInput { readonly manuscript?: { readonly title?: string; readonly author?: string; readonly chapters?: readonly { title: string; number: number }[]; readonly hasTitlePage?: boolean; readonly hasCopyrightPage?: boolean; readonly hasDedication?: boolean; readonly hasEpigraph?: boolean; readonly hasTableOfContents?: boolean; readonly tableOfContentsRequired?: boolean; readonly hasBiography?: boolean; readonly hasAcknowledgments?: boolean; readonly hasAboutTheAuthor?: boolean; readonly hasBackMatter?: boolean; readonly hasSeriesInformation?: boolean; readonly pageCount?: number; }; readonly cover?: { readonly format?: "ebook" | "paperback" | "hardcover" | "series" | "boxed-set" | "promotional" | "audiobook"; readonly widthInches?: number; readonly heightInches?: number; readonly hasFront?: boolean; readonly hasBack?: boolean; readonly hasSpine?: boolean; readonly hasBarcodeSafeArea?: boolean; readonly hasBleed?: boolean; readonly hasTrim?: boolean; readonly hasSafeMargins?: boolean; readonly validated?: boolean; readonly fileType?: string; }; readonly metadata?: { readonly title?: string; readonly author?: string; readonly description?: string; readonly keywords?: readonly string[]; readonly categories?: readonly string[]; }; readonly formatting?: { readonly fileTypes?: readonly string[]; readonly validated?: boolean; readonly pageNumbering?: boolean; readonly headersFooters?: boolean; }; readonly images?: { readonly required?: boolean; readonly count?: number; readonly allResolved?: boolean; readonly allApproved?: boolean; readonly resolutionValidated?: boolean; }; readonly production?: { readonly trim?: boolean; readonly bleed?: boolean; readonly fileTypes?: readonly string[]; readonly validated?: boolean; }; }
export interface PublishingReadinessReport { readonly formatVersion: typeof PUBLISHING_READINESS_FORMAT_VERSION; readonly id: string; readonly projectId: string; readonly bookId?: string; readonly releaseFormat?: PublishingReleaseFormat; readonly createdAt: string; readonly checks: readonly ReadinessCheck[]; readonly passedCount: number; readonly attentionCount: number; readonly status: "ready" | "attention"; }

const CATEGORIES: readonly ReadinessCategory[] = ["manuscript","cover","metadata","formatting","images","table-of-contents","pagination","production"];
const RELEASE_FORMATS: readonly PublishingReleaseFormat[] = ["ebook", "paperback", "hardcover"];
const text = (v: string | undefined): boolean => typeof v === "string" && v.trim().length > 0;
const check = (id: string, category: ReadinessCategory, label: string, ok: boolean, message: string, remediation?: string, severity: ReadinessSeverity = "error"): ReadinessCheck => ({ id, category, label, status: ok ? "passed" : "attention", severity, message, ...(ok ? {} : remediation ? { remediation } : {}) });

export function createPublishingReadinessReport(input: PublishingReadinessInput & { id: string; projectId: string; bookId?: string; releaseFormat?: PublishingReleaseFormat; now?: string }): PublishingReadinessReport {
  if (!input.id.trim() || !input.projectId.trim()) throw new Error("Publishing readiness report id and project id are required.");
  if (input.bookId !== undefined && !input.bookId.trim()) throw new Error("Publishing readiness book id cannot be empty.");
  const inferredFormat = input.releaseFormat ?? (RELEASE_FORMATS.includes(input.cover?.format as PublishingReleaseFormat) ? input.cover?.format as PublishingReleaseFormat : undefined);
  if (input.releaseFormat !== undefined && !RELEASE_FORMATS.includes(input.releaseFormat)) throw new Error("Publishing readiness release format is invalid.");
  const m = input.manuscript, c = input.cover, md = input.metadata, f = input.formatting, i = input.images, p = input.production;
  const print = inferredFormat === "paperback" || inferredFormat === "hardcover";
  const digital = inferredFormat === "ebook";
  const tocRequired = m?.tableOfContentsRequired !== false;
  const imagesRequired = i?.required !== false;
  const checks: ReadinessCheck[] = [
    check("manuscript-present","manuscript","Manuscript",!!m,"Manuscript is present.","Provide the completed manuscript."),
    check("title","metadata","Title",text(md?.title) || text(m?.title),"Title is present.","Add the publication title."),
    check("author","metadata","Author",text(md?.author) || text(m?.author),"Author is present.","Add the author name."),
    check("description","metadata","Description",text(md?.description),"Description is present.","Add a publication description."),
    check("keywords","metadata","Keywords",!!md?.keywords?.length,"Keywords are present.","Add at least one keyword."),
    check("categories","metadata","Categories",!!md?.categories?.length,"Categories are present.","Add at least one category."),
    check("title-page","manuscript","Title page",!!m?.hasTitlePage,"Title page is present.","Add a title page."),
    check("copyright-page","manuscript","Copyright page",!!m?.hasCopyrightPage,"Copyright page is present.","Add a copyright page."),
    check("dedication","manuscript","Dedication",!!m?.hasDedication,"Dedication is present.","Add or explicitly omit the dedication.","warning"),
    check("epigraph","manuscript","Epigraph",!!m?.hasEpigraph,"Epigraph is present.","Add or explicitly omit the epigraph.","warning"),
    check("toc","table-of-contents","Table of contents",!tocRequired || !!m?.hasTableOfContents,!tocRequired ? "Table of contents is explicitly not required for this edition." : "Table of contents is present.","Generate and validate the table of contents, or explicitly mark it not applicable."),
    check("chapter-order","manuscript","Chapter ordering",!!m?.chapters?.length && m.chapters.every((x, n) => x.number === n + 1),"Chapter numbering is sequential.","Correct chapter numbering and ordering."),
    check("page-count","pagination","Page count",!print || (!!m?.pageCount && m.pageCount > 0),print ? "Print page count is available." : "Fixed print page count is not required for this digital release.","Produce a paginated print manuscript."),
    check("biography","manuscript","Author biography",!!m?.hasBiography,"Author biography is present.","Add the author biography.","warning"),
    check("acknowledgments","manuscript","Acknowledgments",!!m?.hasAcknowledgments,"Acknowledgments are present.","Add or explicitly omit acknowledgments.","warning"),
    check("about-author","manuscript","About the author",!!m?.hasAboutTheAuthor,"About-the-author is present.","Add or explicitly omit the section.","warning"),
    check("back-matter","manuscript","Back matter",!!m?.hasBackMatter,"Back matter is present.","Add or explicitly omit back matter.","warning"),
    check("series-information","manuscript","Series information",!!m?.hasSeriesInformation,"Series information is present.","Add or explicitly omit series information.","warning"),
    check("cover-file","cover","Cover file",!!c?.fileType,"Cover file type is declared.","Provide the final cover artifact and file type."),
    check("cover-front","cover","Front cover",!!c?.hasFront,"Front cover is present.","Provide the front cover."),
    check("cover-back","cover","Back cover",digital || !!c?.hasBack,digital ? "Back cover is not required for this eBook release." : "Back cover is present.","Provide the back cover for print covers."),
    check("cover-spine","cover","Spine",digital || !!c?.hasSpine,digital ? "Spine is not required for this eBook release." : "Spine is present.","Provide the spine for print covers."),
    check("barcode-safe","cover","Barcode-safe area",digital || !!c?.hasBarcodeSafeArea,digital ? "Barcode-safe area is not required for this eBook release." : "Barcode-safe area is satisfied.","Reserve the barcode-safe area."),
    check("cover-bleed","cover","Cover bleed",!print || !!c?.hasBleed,print ? "Print cover bleed is declared." : "Print cover bleed is not applicable.","Validate the required print-cover bleed."),
    check("cover-trim","cover","Cover trim",!print || !!c?.hasTrim,print ? "Print cover trim is declared." : "Print cover trim is not applicable.","Validate print trim dimensions."),
    check("cover-margins","cover","Cover safe margins",!print || !!c?.hasSafeMargins,print ? "Print cover safe margins are declared." : "Print cover safe margins are not applicable.","Validate print-cover safe margins."),
    check("cover-dimensions","production","Cover dimensions",!print || (!!c?.widthInches && !!c?.heightInches && c.widthInches > 0 && c.heightInches > 0),print ? "Print cover dimensions are valid." : "Print cover dimensions are not required for this eBook release.","Provide positive final print-cover dimensions."),
    check("cover-validation","production","Cover validation",!!c?.validated,"Cover passed production validation.","Run the cover production validator or confirm validated final cover evidence."),
    check("format-types","formatting","File types",!!f?.fileTypes?.length,"Output file types are declared.","Declare the required publication file types."),
    check("format-validation","formatting","Formatting validation",!!f?.validated,"Formatting passed validation.","Run manuscript production validation."),
    check("page-numbering","pagination","Page numbering",!print || !!f?.pageNumbering,print ? "Print page numbering is configured." : "Fixed print page numbering is not required for this eBook release.","Configure print page numbering."),
    check("headers-footers","formatting","Headers and footers",!print || !!f?.headersFooters,print ? "Headers/footers are configured." : "Fixed print headers/footers are not required for this eBook release.","Configure or explicitly omit print headers/footers.","warning"),
    check("images-present","images","Images",!imagesRequired || (!!i?.count && i.count > 0),imagesRequired ? "Required image assets are present." : "Images are explicitly not required for this edition.","Add the required image assets.",imagesRequired ? "error" : "warning"),
    check("images-resolved","images","Image references",!imagesRequired || !!i?.allResolved,imagesRequired ? "All image references resolve." : "Image references are not applicable.","Resolve missing image assets."),
    check("images-approved","images","Image approvals",!imagesRequired || !!i?.allApproved,imagesRequired ? "All image assets are approved." : "Image approvals are not applicable.","Approve or replace unapproved image assets."),
    check("image-resolution","images","Image resolution",!imagesRequired || !!i?.resolutionValidated,imagesRequired ? "Image resolution passed validation." : "Image-resolution validation is not applicable.","Validate production image resolution."),
    check("production-trim","production","Production trim",!print || !!p?.trim,print ? "Production trim is valid." : "Print trim is not applicable.","Validate print trim settings."),
    check("production-bleed","production","Production bleed",!print || !!p?.bleed,print ? "Production bleed is valid." : "Print bleed is not applicable.","Validate print bleed settings."),
    check("production-file-types","production","Production file types",!!p?.fileTypes?.length,"Production file types are declared.","Declare required production file types."),
    check("production-validation","production","Final production validation",!!p?.validated,"Final production validation passed.","Run final production validation.")
  ];
  const passedCount = checks.filter(x => x.status === "passed").length;
  const attentionCount = checks.length - passedCount;
  return { formatVersion: PUBLISHING_READINESS_FORMAT_VERSION, id: input.id, projectId: input.projectId, ...(input.bookId ? { bookId: input.bookId.trim() } : {}), ...(inferredFormat ? { releaseFormat: inferredFormat } : {}), createdAt: input.now ?? new Date().toISOString(), checks, passedCount, attentionCount, status: attentionCount === 0 ? "ready" : "attention" };
}
export function validatePublishingReadinessReport(report: PublishingReadinessReport): PublishingReadinessReport {
  if (report.formatVersion !== PUBLISHING_READINESS_FORMAT_VERSION) throw new Error("Unsupported publishing readiness format version.");
  if (!report.id.trim() || !report.projectId.trim()) throw new Error("Publishing readiness report id and project id are required.");
  if (report.bookId !== undefined && !report.bookId.trim()) throw new Error("Publishing readiness book id cannot be empty.");
  if (report.releaseFormat !== undefined && !RELEASE_FORMATS.includes(report.releaseFormat)) throw new Error("Publishing readiness release format is invalid.");
  if (!Array.isArray(report.checks) || report.checks.length === 0) throw new Error("Publishing readiness report must contain checks.");
  if (!report.checks.every(c => c.id.trim() && CATEGORIES.includes(c.category) && (c.status === "passed" || c.status === "attention") && (c.severity === "error" || c.severity === "warning"))) throw new Error("Publishing readiness report contains an invalid check.");
  const passed = report.checks.filter(c => c.status === "passed").length;
  const attention = report.checks.length - passed;
  if (report.passedCount !== passed || report.attentionCount !== attention || report.status !== (attention === 0 ? "ready" : "attention")) throw new Error("Publishing readiness report summary is inconsistent.");
  return JSON.parse(JSON.stringify(report)) as PublishingReadinessReport;
}
