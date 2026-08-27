import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ImageEditingState } from "../domain/image-editing";
import { createImageEditingState, validateImageEditingState } from "../domain/image-editing";
export class FileImageEditingStore {
 public constructor(private readonly rootDirectory:string){}
 public async save(projectId:string,state:ImageEditingState):Promise<void>{if(state.projectId!==projectId)throw new Error("Image editing state belongs to another project.");const validated=validateImageEditingState(state);const path=this.path(projectId);await mkdir(dirname(path),{recursive:true});const temp=`${path}.tmp`;await writeFile(temp,`${JSON.stringify(validated,null,2)}\n`,"utf8");await rename(temp,path);}
 public async load(projectId:string):Promise<ImageEditingState>{try{return validateImageEditingState(JSON.parse(await readFile(this.path(projectId),"utf8")));}catch(error){if(missing(error))return createImageEditingState(projectId);throw error;}}
 public async exists(projectId:string):Promise<boolean>{try{await access(this.path(projectId));return true;}catch(error){if(missing(error))return false;throw error;}}
 private path(projectId:string):string{if(!/^[a-zA-Z0-9_-]+$/.test(projectId))throw new Error("Project id contains unsupported path characters.");return join(this.rootDirectory,"projects",projectId,"image-editing.json");}
}
function missing(error:unknown):boolean{return typeof error==="object"&&error!==null&&"code"in error&&(error as {code?:string}).code==="ENOENT";}
