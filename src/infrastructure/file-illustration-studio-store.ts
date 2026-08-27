import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { IllustrationStudioState } from "../domain/illustration-studio";
import { createIllustrationStudioState, validateIllustrationRequest, validateIllustrationRevision, withIllustrationRequest, withIllustrationRevision } from "../domain/illustration-studio";
export class FileIllustrationStudioStore {
  public constructor(private readonly rootDirectory:string){}
  public async save(projectId:string,state:IllustrationStudioState):Promise<void>{if(state.projectId!==projectId)throw new Error("Illustration studio state belongs to another project.");const validated=this.validate(projectId,state);const path=this.path(projectId);await mkdir(dirname(path),{recursive:true});const temp=`${path}.tmp`;await writeFile(temp,`${JSON.stringify(validated,null,2)}\n`,"utf8");await rename(temp,path);}
  public async load(projectId:string):Promise<IllustrationStudioState>{try{const parsed:unknown=JSON.parse(await readFile(this.path(projectId),"utf8"));return this.validate(projectId,parsed);}catch(error){if(missing(error))return createIllustrationStudioState(projectId);throw error;}}
  public async exists(projectId:string):Promise<boolean>{try{await access(this.path(projectId));return true;}catch(error){if(missing(error))return false;throw error;}}
  private validate(projectId:string,value:unknown):IllustrationStudioState{if(!value||typeof value!=="object")throw new Error("Invalid illustration studio state.");const x=value as IllustrationStudioState;if(x.formatVersion!==1||x.projectId!==projectId||!Array.isArray(x.requests)||!Array.isArray(x.revisions))throw new Error("Invalid illustration studio state.");let state=createIllustrationStudioState(projectId);for(const request of x.requests)state=withIllustrationRequest(state,validateIllustrationRequest(request));for(const revision of x.revisions)state=withIllustrationRevision(state,validateIllustrationRevision(revision));return state;}
  private path(projectId:string):string{if(!/^[a-zA-Z0-9_-]+$/.test(projectId))throw new Error("Project id contains unsupported path characters.");return join(this.rootDirectory,"projects",projectId,"illustration-studio.json");}
}
function missing(error:unknown):boolean{return typeof error==="object"&&error!==null&&"code"in error&&(error as {code?:string}).code==="ENOENT";}
