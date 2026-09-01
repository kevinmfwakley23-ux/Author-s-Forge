import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateEducationalAssessmentRecord, validateEducationalRubric, type EducationalAssessmentRecord, type EducationalRubric } from "../domain/educational-assessment";

export const EDUCATIONAL_ASSESSMENT_STORE_FORMAT_VERSION = 1 as const;
interface State { readonly formatVersion: typeof EDUCATIONAL_ASSESSMENT_STORE_FORMAT_VERSION; readonly rubrics: readonly EducationalRubric[]; readonly assessments: readonly EducationalAssessmentRecord[]; }

export class FileEducationalAssessmentStore {
  private rubrics: EducationalRubric[] = [];
  private assessments: EducationalAssessmentRecord[] = [];
  private loaded = false;
  constructor(private readonly filePath: string) { if (!filePath.trim()) throw new Error("Educational assessment store path is required."); }

  async listRubrics(projectId: string): Promise<readonly EducationalRubric[]> { await this.load(); const project = required(projectId, "Project id"); return this.rubrics.filter((item) => item.projectId === project).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.id.localeCompare(a.id)).map(clone); }
  async getRubric(projectId: string, rubricId: string): Promise<EducationalRubric | undefined> { await this.load(); const item=this.rubrics.find((rubric)=>rubric.projectId===required(projectId,"Project id")&&rubric.id===required(rubricId,"Rubric id")); return item?clone(item):undefined; }
  async saveRubric(rubric: EducationalRubric): Promise<EducationalRubric> { await this.load(); validateEducationalRubric(rubric); if(this.rubrics.some((item)=>item.projectId===rubric.projectId&&item.id===rubric.id))throw new Error(`Duplicate educational rubric id "${rubric.id}".`); this.rubrics.push(clone(rubric)); await this.persist(); return clone(rubric); }
  async listAssessments(projectId: string, rubricId?: string): Promise<readonly EducationalAssessmentRecord[]> { await this.load(); const project=required(projectId,"Project id"); return this.assessments.filter((item)=>item.projectId===project&&(!rubricId||item.rubricId===rubricId)).sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)||b.id.localeCompare(a.id)).map(clone); }
  async saveAssessment(record: EducationalAssessmentRecord): Promise<EducationalAssessmentRecord> { await this.load(); const rubric=this.rubrics.find((item)=>item.projectId===record.projectId&&item.id===record.rubricId); if(!rubric)throw new Error(`Assessment references missing rubric "${record.rubricId}".`); validateEducationalAssessmentRecord(record,rubric); if(this.assessments.some((item)=>item.projectId===record.projectId&&item.id===record.id))throw new Error(`Duplicate educational assessment id "${record.id}".`); this.assessments.push(clone(record)); await this.persist(); return clone(record); }

  private async load():Promise<void>{ if(this.loaded)return; try{const parsed=JSON.parse(await readFile(this.filePath,"utf8")) as State;if(parsed.formatVersion!==EDUCATIONAL_ASSESSMENT_STORE_FORMAT_VERSION||!Array.isArray(parsed.rubrics)||!Array.isArray(parsed.assessments))throw new Error("Unsupported or corrupt educational assessment store.");const rubricKeys=new Set<string>();this.rubrics=parsed.rubrics.map((value)=>{const rubric=validateEducationalRubric(value);const key=`${rubric.projectId}\0${rubric.id}`;if(rubricKeys.has(key))throw new Error(`Duplicate educational rubric id "${rubric.id}" in store.`);rubricKeys.add(key);return clone(rubric);});const assessmentKeys=new Set<string>();this.assessments=parsed.assessments.map((value)=>{const rubric=this.rubrics.find((item)=>item.projectId===value.projectId&&item.id===value.rubricId);if(!rubric)throw new Error(`Stored assessment references missing rubric "${value.rubricId}".`);const record=validateEducationalAssessmentRecord(value,rubric);const key=`${record.projectId}\0${record.id}`;if(assessmentKeys.has(key))throw new Error(`Duplicate educational assessment id "${record.id}" in store.`);assessmentKeys.add(key);return clone(record);});}catch(error){if(!isMissing(error))throw error;}this.loaded=true; }
  private async persist():Promise<void>{await mkdir(dirname(this.filePath),{recursive:true});const state:State={formatVersion:EDUCATIONAL_ASSESSMENT_STORE_FORMAT_VERSION,rubrics:this.rubrics.map(clone),assessments:this.assessments.map(clone)};const temp=`${this.filePath}.${process.pid}.${Date.now()}.tmp`;await writeFile(temp,`${JSON.stringify(state,null,2)}\n`,"utf8");await rename(temp,this.filePath);}
}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
function required(value:string,label:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required.`);return value.trim();}
function isMissing(error:unknown):boolean{return Boolean(error&&typeof error==="object"&&"code" in error&&(error as{code?:string}).code==="ENOENT");}
