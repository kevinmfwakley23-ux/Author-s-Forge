export const PUBLISHING_READINESS_FORMAT_VERSION = 1 as const;
export type ReadinessStatus = "passed" | "attention";
export type ReadinessSeverity = "error" | "warning";
export type ReadinessCategory = "manuscript" | "cover" | "metadata" | "formatting" | "images" | "table-of-contents" | "pagination" | "production";
export interface ReadinessCheck { readonly id: string; readonly category: ReadinessCategory; readonly label: string; readonly status: ReadinessStatus; readonly severity: ReadinessSeverity; readonly message: string; readonly remediation?: string; }
export interface PublishingReadinessInput { readonly manuscript?: { readonly title?: string; readonly author?: string; readonly chapters?: readonly { title: string; number: number }[]; readonly hasTitlePage?: boolean; readonly hasCopyrightPage?: boolean; readonly hasDedication?: boolean; readonly hasEpigraph?: boolean; readonly hasTableOfContents?: boolean; readonly hasBiography?: boolean; readonly hasAcknowledgments?: boolean; readonly hasAboutTheAuthor?: boolean; readonly hasBackMatter?: boolean; readonly hasSeriesInformation?: boolean; readonly pageCount?: number; }; readonly cover?: { readonly format?: "ebook" | "paperback" | "hardcover" | "series" | "boxed-set" | "promotional" | "audiobook"; readonly widthInches?: number; readonly heightInches?: number; readonly hasFront?: boolean; readonly hasBack?: boolean; readonly hasSpine?: boolean; readonly hasBarcodeSafeArea?: boolean; readonly hasBleed?: boolean; readonly hasTrim?: boolean; readonly hasSafeMargins?: boolean; readonly validated?: boolean; readonly fileType?: string; }; readonly metadata?: { readonly title?: string; readonly author?: string; readonly description?: string; readonly keywords?: readonly string[]; readonly categories?: readonly string[]; }; readonly formatting?: { readonly fileTypes?: readonly string[]; readonly validated?: boolean; readonly pageNumbering?: boolean; readonly headersFooters?: boolean; }; readonly images?: { readonly count?: number; readonly allResolved?: boolean; readonly allApproved?: boolean; readonly resolutionValidated?: boolean; }; readonly production?: { readonly trim?: boolean; readonly bleed?: boolean; readonly fileTypes?: readonly string[]; readonly validated?: boolean; }; }
export interface PublishingReadinessReport { readonly formatVersion: typeof PUBLISHING_READINESS_FORMAT_VERSION; readonly id: string; readonly projectId: string; readonly createdAt: string; readonly checks: readonly ReadinessCheck[]; readonly passedCount: number; readonly attentionCount: number; readonly status: "ready" | "attention"; }

const CATEGORIES: readonly ReadinessCategory[] = ["manuscript","cover","metadata","formatting","images","table-of-contents","pagination","production"];
const text = (v: string | undefined, label: string): boolean => typeof v === "string" && v.trim().length > 0;
const check = (id: string, category: ReadinessCategory, label: string, ok: boolean, message: string, remediation?: string, severity: ReadinessSeverity = "error"): ReadinessCheck => ({ id, category, label, status: ok ? "passed" : "attention", severity, message, ...(ok ? {} : remediation ? { remediation } : {}) });

export function createPublishingReadinessReport(input: PublishingReadinessInput & { id: string; projectId: string; now?: string }): PublishingReadinessReport {
  if (!input.id.trim() || !input.projectId.trim()) throw new Error("Publishing readiness report id and project id are required.");
  const m = input.manuscript, c = input.cover, md = input.metadata, f = input.formatting, i = input.images, p = input.production;
  const checks: ReadinessCheck[] = [
    check("manuscript-present","manuscript","Manuscript",!!m,"Manuscript is present.","Provide the completed manuscript."),
    check("title","metadata","Title",text(md?.title) || text(m?.title),"Title is present.","Add the publication title."),
    check("author","metadata","Author",text(md?.author) || text(m?.author),"Author is present.","Add the author name."),
    check("description","metadata","Description",text(md?.description),"Description is present.","Add a publication description."),
    check("keywords","metadata","Keywords",!!md?.keywords?.length,"Keywords are present.","Add at least one keyword."),
    check("categories","metadata","Categories",!!md?.categories?.length,"Categories are present.","Add at least one category."),
    check("title-page","manuscript","Title page",!!m?.hasTitlePage,"Title page is present.","Add a title page."),
    check("copyright-page","manuscript","Copyright page",!!m?.hasCopyrightPage,"Copyright page is present.","Add a copyright page."),
    check("dedication","manuscript","Dedication",!!m?.hasDedication,"Dedication is present.","Add or explicitly omit the dedication." ,"warning"),
    check("epigraph","manuscript","Epigraph",!!m?.hasEpigraph,"Epigraph is present.","Add or explicitly omit the epigraph.","warning"),
    check("toc","table-of-contents","Table of contents",!!m?.hasTableOfContents,"Table of contents is present.","Generate and validate the table of contents."),
    check("chapter-order","manuscript","Chapter ordering",!!m?.chapters?.length && m.chapters.every((x, n) => x.number === n + 1),"Chapter numbering is sequential.","Correct chapter numbering and ordering."),
    check("page-count","pagination","Page count",!!m?.pageCount && m.pageCount > 0,"Page count is available.","Produce a paginated manuscript."),
    check("biography","manuscript","Author biography",!!m?.hasBiography,"Author biography is present.","Add the author biography.","warning"),
    check("acknowledgments","manuscript","Acknowledgments",!!m?.hasAcknowledgments,"Acknowledgments are present.","Add or explicitly omit acknowledgments.","warning"),
    check("about-author","manuscript","About the author",!!m?.hasAboutTheAuthor,"About-the-author is present.","Add or explicitly omit the section.","warning"),
    check("back-matter","manuscript","Back matter",!!m?.hasBackMatter,"Back matter is present.","Add or explicitly omit back matter.","warning"),
    check("series-information","manuscript","Series information",!!m?.hasSeriesInformation,"Series information is present.","Add or explicitly omit series information.","warning"),
    check("cover-file","cover","Cover file",!!c?.fileType,"Cover file type is declared.","Provide the cover artifact and file type."),
    check("cover-front","cover","Front cover",!!c?.hasFront,"Front cover is present.","Provide the front cover."),
    check("cover-back","cover","Back cover",c?.format === "ebook" || c?.format === "audiobook" || !!c?.hasBack,"Back cover requirement is satisfied.","Provide the back cover for print covers."),
    check("cover-spine","cover","Spine",c?.format === "ebook" || c?.format === "audiobook" || !!c?.hasSpine,"Spine requirement is satisfied.","Provide the spine for print covers."),
    check("barcode-safe","cover","Barcode-safe area",c?.format === "ebook" || c?.format === "audiobook" || !!c?.hasBarcodeSafeArea,"Barcode-safe area is satisfied.","Reserve the barcode-safe area."),
    check("cover-bleed","cover","Bleed",!!c?.hasBleed,"Bleed is declared.","Validate the required bleed."),
    check("cover-trim","cover","Trim",!!c?.hasTrim,"Trim is declared.","Validate trim dimensions."),
    check("cover-margins","cover","Safe margins",!!c?.hasSafeMargins,"Safe margins are declared.","Validate safe margins."),
    check("cover-dimensions","production","Cover dimensions",!!c?.widthInches && !!c?.heightInches && c.widthInches > 0 && c.heightInches > 0,"Cover dimensions are valid.","Provide positive production dimensions."),
    check("cover-validation","production","Cover validation",!!c?.validated,"Cover passed production validation.","Run the cover production validator."),
    check("format-types","formatting","File types",!!f?.fileTypes?.length,"Output file types are declared.","Declare the required publication file types."),
    check("format-validation","formatting","Formatting validation",!!f?.validated,"Formatting passed validation.","Run manuscript production validation."),
    check("page-numbering","pagination","Page numbering",!!f?.pageNumbering,"Page numbering is configured.","Configure page numbering."),
    check("headers-footers","formatting","Headers and footers",!!f?.headersFooters,"Headers/footers are configured.","Configure or explicitly omit headers/footers.","warning"),
    check("images-present","images","Images",!!i?.count && i.count > 0,"Illustration assets are present.","Add or explicitly confirm that no images are required.","warning"),
    check("images-resolved","images","Image references",!!i?.allResolved,"All image references resolve.","Resolve missing image assets."),
    check("images-approved","images","Image approvals",!!i?.allApproved,"All image assets are approved.","Approve or replace unapproved image assets."),
    check("image-resolution","images","Image resolution",!!i?.resolutionValidated,"Image resolution passed validation.","Validate production image resolution."),
    check("production-trim","production","Production trim",!!p?.trim,"Production trim is valid.","Validate trim settings."),
    check("production-bleed","production","Production bleed",!!p?.bleed,"Production bleed is valid.","Validate bleed settings."),
    check("production-file-types","production","Production file types",!!p?.fileTypes?.length,"Production file types are declared.","Declare required production file types."),
    check("production-validation","production","Final production validation",!!p?.validated,"Final production validation passed.","Run final production validation.")
  ];
  const passedCount = checks.filter(x => x.status === "passed").length;
  const attentionCount = checks.length - passedCount;
  return { formatVersion: PUBLISHING_READINESS_FORMAT_VERSION, id: input.id, projectId: input.projectId, createdAt: input.now ?? new Date().toISOString(), checks, passedCount, attentionCount, status: attentionCount === 0 ? "ready" : "attention" };
}
export function validatePublishingReadinessReport(report: PublishingReadinessReport): PublishingReadinessReport {
  if (report.formatVersion !== PUBLISHING_READINESS_FORMAT_VERSION) throw new Error("Unsupported publishing readiness format version.");
  if (!report.id.trim() || !report.projectId.trim()) throw new Error("Publishing readiness report id and project id are required.");
  if (!Array.isArray(report.checks) || report.checks.length === 0) throw new Error("Publishing readiness report must contain checks.");
  if (!report.checks.every(c => c.id.trim() && CATEGORIES.includes(c.category) && (c.status === "passed" || c.status === "attention") && (c.severity === "error" || c.severity === "warning"))) throw new Error("Publishing readiness report contains an invalid check.");
  const passed = report.checks.filter(c => c.status === "passed").length;
  const attention = report.checks.length - passed;
  if (report.passedCount !== passed || report.attentionCount !== attention || report.status !== (attention === 0 ? "ready" : "attention")) throw new Error("Publishing readiness report summary is inconsistent.");
  return JSON.parse(JSON.stringify(report)) as PublishingReadinessReport;
}
