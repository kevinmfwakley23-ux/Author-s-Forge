import type { SpecializedArtifactKind, SpecializedOfficeProject } from "../domain/specialized-creation-office";
import type { SpecializedPreflightIssue, SpecializedPreflightReport } from "./specialized-creation-production-engine";

const COMMON_PDF_REPLACEMENTS:Readonly<Record<string,string>>=Object.freeze({
  "’":"'","‘":"'","“":"\"","”":"\"","–":"-","—":"--","…":"...","•":"*"," ":" ","©":"(c)","®":"(R)","™":"(TM)",
});

export function specializedProductionSafetyIssues(project:SpecializedOfficeProject,kind?:SpecializedArtifactKind):SpecializedPreflightIssue[] {
  const issues:SpecializedPreflightIssue[]=[];
  for(const document of project.documents)for(const surface of document.surfaces)for(const element of surface.elements){
    if(element.kind==="qr")issues.push({code:"QR_RENDERER_UNAVAILABLE",severity:"error",message:`QR element ${element.id} cannot enter production until a real decodable QR renderer is installed. Destination remains preserved in project state.`,documentId:document.id,surfaceId:surface.id,elementId:element.id});
    if(element.kind==="text"&&element.text&&containsNonAscii(element.text)){
      const unsupported=pdfUnsupportedCharacters(element.text);
      if(kind==="pdf"&&unsupported.length)issues.push({code:"PDF_UNSUPPORTED_GLYPHS",severity:"error",message:`Text element ${element.id} contains characters the built-in PDF font cannot preserve (${unsupported.join(" ")}). Use the Unicode SVG path or an approved embedded-font production path.`,documentId:document.id,surfaceId:surface.id,elementId:element.id});
      else if(!kind||kind==="pdf")issues.push({code:"PDF_TYPOGRAPHY_NORMALIZATION",severity:"warning",message:`Text element ${element.id} contains typographic Unicode. The built-in PDF path normalizes supported punctuation; the SVG path preserves Unicode exactly.`,documentId:document.id,surfaceId:surface.id,elementId:element.id});
    }
  }
  return issues;
}

export function mergeSpecializedPreflight(report:SpecializedPreflightReport,extra:readonly SpecializedPreflightIssue[]):SpecializedPreflightReport {
  const issues=Object.freeze([...report.issues,...extra]);const blocking=issues.filter(issue=>issue.severity==="error").length,warnings=issues.filter(issue=>issue.severity==="warning").length;
  return Object.freeze({...report,issues,blocking,warnings,ready:blocking===0});
}

export function prepareSpecializedProjectForArtifact(project:SpecializedOfficeProject,kind:SpecializedArtifactKind):SpecializedOfficeProject {
  const issues=specializedProductionSafetyIssues(project,kind),errors=issues.filter(issue=>issue.severity==="error");if(errors.length)throw new Error(errors.map(issue=>`${issue.code}: ${issue.message}`).join(" | "));
  if(kind!=="pdf")return clone(project);
  return {...clone(project),documents:project.documents.map(document=>({...clone(document),surfaces:document.surfaces.map(surface=>({...clone(surface),elements:surface.elements.map(element=>element.kind==="text"&&element.text?{...clone(element),text:normalizePdfText(element.text)}:clone(element))}))}))};
}

export function normalizePdfText(value:string):string {let out="";for(const char of value){if(char.charCodeAt(0)<=0x7e){out+=char;continue;}const replacement=COMMON_PDF_REPLACEMENTS[char];if(replacement!==undefined){out+=replacement;continue;}out+=char;}return out;}
function pdfUnsupportedCharacters(value:string):string[]{return [...new Set([...value].filter(char=>char.charCodeAt(0)>0x7e&&COMMON_PDF_REPLACEMENTS[char]===undefined))];}
function containsNonAscii(value:string):boolean{return [...value].some(char=>char.charCodeAt(0)>0x7e);}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
