import type { SpecializedArtifactKind, SpecializedOfficeProject, SpecializedProductionProfile } from "../domain/specialized-creation-office";
import type { SpecializedPreflightIssue, SpecializedPreflightReport } from "./specialized-creation-production-engine";
import { createSpecializedQrMatrix, specializedQrModuleSizeInches } from "./specialized-creation-qr";

const COMMON_PDF_REPLACEMENTS:Readonly<Record<string,string>>=Object.freeze({
  "’":"'","‘":"'","“":"\"","”":"\"","–":"-","—":"--","…":"...","•":"*"," ":" ","©":"(c)","®":"(R)","™":"(TM)",
});
const MIN_QR_MODULE_INCHES=0.012;
const MIN_QR_PRINTER_PIXELS_PER_MODULE=4;

export function specializedProductionSafetyIssues(project:SpecializedOfficeProject,kind?:SpecializedArtifactKind,profile?:SpecializedProductionProfile):SpecializedPreflightIssue[] {
  const issues:SpecializedPreflightIssue[]=[];
  for(const document of project.documents)for(const surface of document.surfaces)for(const element of surface.elements){
    if(element.kind==="qr"){
      const destination=typeof element.metadata.destination==="string"?element.metadata.destination.trim():"";
      if(destination){
        try{
          const matrix=createSpecializedQrMatrix(destination);
          const moduleInches=specializedQrModuleSizeInches(destination,element.box.width,element.box.height);
          const minimum=profile?Math.max(MIN_QR_MODULE_INCHES,MIN_QR_PRINTER_PIXELS_PER_MODULE/profile.dpi):MIN_QR_MODULE_INCHES;
          if(moduleInches<minimum)issues.push({code:"QR_MODULE_TOO_SMALL",severity:"error",message:`QR element ${element.id} produces ${matrix.size} data modules at about ${(moduleInches*25.4).toFixed(2)} mm per module. Increase its physical size so each module is at least ${(minimum*25.4).toFixed(2)} mm${profile?` (${MIN_QR_PRINTER_PIXELS_PER_MODULE} pixels at ${profile.dpi} DPI)`:""}.`,documentId:document.id,surfaceId:surface.id,elementId:element.id});
        }catch(error){issues.push({code:"QR_ENCODING_UNSUPPORTED",severity:"error",message:`QR element ${element.id} cannot be encoded for production: ${error instanceof Error?error.message:String(error)}`,documentId:document.id,surfaceId:surface.id,elementId:element.id});}
      }
    }
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

export function prepareSpecializedProjectForArtifact(project:SpecializedOfficeProject,kind:SpecializedArtifactKind,profile?:SpecializedProductionProfile):SpecializedOfficeProject {
  const issues=specializedProductionSafetyIssues(project,kind,profile),errors=issues.filter(issue=>issue.severity==="error");if(errors.length)throw new Error(errors.map(issue=>`${issue.code}: ${issue.message}`).join(" | "));
  if(kind!=="pdf")return clone(project);
  return {...clone(project),documents:project.documents.map(document=>({...clone(document),surfaces:document.surfaces.map(surface=>({...clone(surface),elements:surface.elements.map(element=>element.kind==="text"&&element.text?{...clone(element),text:normalizePdfText(element.text)}:clone(element))}))}))};
}

export function normalizePdfText(value:string):string {let out="";for(const char of value){if(char.charCodeAt(0)<=0x7e){out+=char;continue;}const replacement=COMMON_PDF_REPLACEMENTS[char];if(replacement!==undefined){out+=replacement;continue;}out+=char;}return out;}
function pdfUnsupportedCharacters(value:string):string[]{return [...new Set([...value].filter(char=>char.charCodeAt(0)>0x7e&&COMMON_PDF_REPLACEMENTS[char]===undefined))];}
function containsNonAscii(value:string):boolean{return [...value].some(char=>char.charCodeAt(0)>0x7e);}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
