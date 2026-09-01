import type { IncomingMessage, ServerResponse } from "node:http";
import { EducationalAssessmentService } from "./educational-assessment";
import { EDUCATIONAL_RESPONSE_MODES, type EducationalAssessmentScore, type EducationalResponseMode, type EducationalRubricCriterion, type EducationalRubricLevel } from "../domain/educational-assessment";
import { FileEducationalAssessmentStore } from "../infrastructure/file-educational-assessment-store";

export type EducationalAssessmentRouteHandler=(req:IncomingMessage,res:ServerResponse,url:URL,projectId:string)=>Promise<boolean>;
export function createEducationalAssessmentRoutes(storePath:string):EducationalAssessmentRouteHandler{
  const service=new EducationalAssessmentService(new FileEducationalAssessmentStore(required(storePath,"Educational assessment store path")));
  return async(req,res,url,projectId)=>{
    const base=`/api/projects/${projectId}/workbooks/assessment`;
    if(url.pathname===`${base}/rubrics`&&req.method==="GET"){json(res,200,{rubrics:await service.listRubrics(projectId)});return true;}
    if(url.pathname===`${base}/rubrics`&&req.method==="POST"){
      const input=await body(req);const rubric=await service.createRubric({
        id:required(input.id,"Rubric id"),projectId,title:required(input.title,"Rubric title"),description:optional(input.description),gradeBand:required(input.gradeBand,"Rubric grade band"),
        standards:strings(input.standards),allowedResponseModes:modes(input.allowedResponseModes),criteria:criteria(input.criteria),...(Array.isArray(input.levels)&&input.levels.length?{levels:levels(input.levels)}:{}),
      });json(res,201,rubric);return true;
    }
    const rubricMatch=url.pathname.match(new RegExp(`^${escapeRegExp(base)}/rubrics/([^/]+)$`));
    if(rubricMatch&&req.method==="GET"){const rubric=await service.getRubric(projectId,decodeURIComponent(rubricMatch[1]));json(res,rubric?200:404,rubric??{error:"Educational rubric not found."});return true;}
    if(url.pathname===`${base}/records`&&req.method==="GET"){json(res,200,{records:await service.listAssessments(projectId,url.searchParams.get("rubricId")||undefined)});return true;}
    if(url.pathname===`${base}/records`&&req.method==="POST"){
      const input=await body(req);const record=await service.score({id:required(input.id,"Assessment id"),projectId,rubricId:required(input.rubricId,"Rubric id"),activityOrTaskId:required(input.activityOrTaskId,"Activity or task id"),responseMode:mode(input.responseMode),scores:scores(input.scores),feedback:optional(input.feedback)});json(res,201,record);return true;
    }
    return false;
  };
}
function json(res:ServerResponse,status:number,value:unknown):void{res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(value));}
async function body(req:IncomingMessage):Promise<Record<string,unknown>>{let raw="";for await(const chunk of req){raw+=String(chunk);if(raw.length>2*1024*1024)throw new Error("Assessment request body exceeds 2 MiB limit.");}if(!raw.trim())return{};const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("JSON object body required.");return parsed as Record<string,unknown>;}
function criteria(value:unknown):EducationalRubricCriterion[]{if(!Array.isArray(value))throw new Error("Rubric criteria must be an array.");return value.map((item,index)=>{if(!item||typeof item!=="object"||Array.isArray(item))throw new Error(`Rubric criterion ${index+1} must be an object.`);const v=item as Record<string,unknown>;return{id:required(v.id,"Criterion id"),name:required(v.name,"Criterion name"),description:required(v.description,"Criterion description"),weightPercent:Number(v.weightPercent),learningObjective:required(v.learningObjective,"Criterion learning objective"),evidenceGuidance:required(v.evidenceGuidance,"Criterion evidence guidance")};});}
function levels(value:unknown[]):EducationalRubricLevel[]{return value.map((item,index)=>{if(!item||typeof item!=="object"||Array.isArray(item))throw new Error(`Rubric level ${index+1} must be an object.`);const v=item as Record<string,unknown>;return{id:required(v.id,"Rubric level id"),label:required(v.label,"Rubric level label"),score:Number(v.score),description:required(v.description,"Rubric level description")};});}
function scores(value:unknown):EducationalAssessmentScore[]{if(!Array.isArray(value))throw new Error("Assessment scores must be an array.");return value.map((item,index)=>{if(!item||typeof item!=="object"||Array.isArray(item))throw new Error(`Assessment score ${index+1} must be an object.`);const v=item as Record<string,unknown>;return{criterionId:required(v.criterionId,"Assessment criterion id"),levelId:required(v.levelId,"Assessment level id"),evidenceNote:optional(v.evidenceNote)};});}
function modes(value:unknown):EducationalResponseMode[]{const result=strings(value);if(!result.length)return["written"];return result.map((item)=>mode(item));}
function mode(value:unknown):EducationalResponseMode{if(typeof value!=="string"||!EDUCATIONAL_RESPONSE_MODES.includes(value as EducationalResponseMode))throw new Error("Invalid educational response mode.");return value as EducationalResponseMode;}
function strings(value:unknown):string[]{return Array.isArray(value)?[...new Set(value.filter((item):item is string=>typeof item==="string").map((item)=>item.trim()).filter(Boolean))]:typeof value==="string"?[...new Set(value.split(/[\n,]/).map((item)=>item.trim()).filter(Boolean))]:[];}
function required(value:unknown,label:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required.`);return value.trim();}
function optional(value:unknown):string{return typeof value==="string"?value.trim():"";}
function escapeRegExp(value:string):string{return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
