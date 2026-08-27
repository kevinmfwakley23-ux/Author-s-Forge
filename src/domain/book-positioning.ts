export const BOOK_POSITIONING_FORMAT_VERSION = 1 as const;

export interface PositioningComparable { readonly title: string; readonly author?: string; readonly reason: string; }
export interface PositioningAnswer { readonly audience: string; readonly problemOrDesire: string; readonly genre: string; readonly shelf: string; readonly differentiation: string; readonly comparableBooks: readonly PositioningComparable[]; readonly clickReason: string; }
export interface PositioningConcepts { readonly titles: readonly string[]; readonly subtitles: readonly string[]; readonly hooks: readonly string[]; readonly elevatorPitches: readonly string[]; readonly backCoverCopy: string; readonly amazonDescription: string; readonly authorBio: string; readonly taglines: readonly string[]; readonly promotionalHooks: readonly string[]; }
export interface BookPositioningReport {
  readonly formatVersion: typeof BOOK_POSITIONING_FORMAT_VERSION;
  readonly id: string; readonly projectId: string; readonly bookId?: string; readonly createdAt: string;
  readonly positioning: PositioningAnswer; readonly concepts: PositioningConcepts; readonly evidence: readonly string[]; readonly limitations: readonly string[];
  readonly disclaimer: string;
}
export interface CreateBookPositioningReportInput extends Omit<BookPositioningReport, "formatVersion" | "createdAt"> { readonly createdAt?: string; }

export const BOOK_POSITIONING_DISCLAIMER = "Positioning is a strategic interpretation of supplied manuscript and market evidence. It is not a guarantee of reader response, clicks, rankings, sales, revenue, or commercial performance.";

export function createBookPositioningReport(input: CreateBookPositioningReportInput): BookPositioningReport {
  const report: BookPositioningReport = { formatVersion: BOOK_POSITIONING_FORMAT_VERSION, id: text(input.id,"Positioning id"), projectId: text(input.projectId,"Positioning project id"), ...(input.bookId ? {bookId:text(input.bookId,"Positioning book id")} : {}), createdAt: input.createdAt ?? new Date().toISOString(), positioning: validatePositioning(input.positioning), concepts: validateConcepts(input.concepts), evidence: input.evidence.map((v)=>text(v,"Positioning evidence")), limitations: input.limitations.map((v)=>text(v,"Positioning limitation")), disclaimer: input.disclaimer };
  return validateBookPositioningReport(report);
}
export function validateBookPositioningReport(report: BookPositioningReport): BookPositioningReport {
  if (report.formatVersion !== BOOK_POSITIONING_FORMAT_VERSION) throw new Error("Unsupported book positioning format version.");
  text(report.id,"Positioning id"); text(report.projectId,"Positioning project id");
  if (!Number.isFinite(Date.parse(report.createdAt))) throw new Error("Positioning createdAt must be an ISO timestamp.");
  const positioning=validatePositioning(report.positioning), concepts=validateConcepts(report.concepts);
  if (!Array.isArray(report.evidence)||!Array.isArray(report.limitations)) throw new Error("Positioning evidence and limitations must be arrays.");
  if (report.disclaimer !== BOOK_POSITIONING_DISCLAIMER) throw new Error("Book positioning must use the required non-guarantee disclaimer.");
  return JSON.parse(JSON.stringify({...report,positioning,concepts,evidence:report.evidence.map(v=>text(v,"Positioning evidence")),limitations:report.limitations.map(v=>text(v,"Positioning limitation"))})) as BookPositioningReport;
}
function validatePositioning(v: PositioningAnswer): PositioningAnswer { text(v.audience,"Target audience"); text(v.problemOrDesire,"Problem or desire"); text(v.genre,"Genre"); text(v.shelf,"Shelf"); text(v.differentiation,"Differentiation"); text(v.clickReason,"Click reason"); return { ...v, comparableBooks:v.comparableBooks.map(c=>({title:text(c.title,"Comparable title"),...(c.author?{author:text(c.author,"Comparable author")} : {}),reason:text(c.reason,"Comparable reason")}))}; }
function validateConcepts(v: PositioningConcepts): PositioningConcepts { for(const value of [v.titles,v.subtitles,v.hooks,v.elevatorPitches,v.taglines,v.promotionalHooks]) { if(!Array.isArray(value)||value.length===0||value.some(x=>!textOptional(x))) throw new Error("Positioning concept lists must contain text."); } for(const value of [v.backCoverCopy,v.amazonDescription,v.authorBio]) text(value,"Positioning copy"); return {...v,titles:[...v.titles],subtitles:[...v.subtitles],hooks:[...v.hooks],elevatorPitches:[...v.elevatorPitches],taglines:[...v.taglines],promotionalHooks:[...v.promotionalHooks]}; }
function text(v: string|undefined,label:string):string { if(typeof v!=="string"||!v.trim()) throw new Error(`${label} is required.`); return v.trim(); }
function textOptional(v: unknown): v is string { return typeof v === "string" && v.trim().length>0; }
