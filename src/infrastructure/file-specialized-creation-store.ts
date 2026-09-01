import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { SPECIALIZED_OFFICE_FORMAT_VERSION, validateSpecializedOfficeProject, type SpecializedOfficeProject } from "../domain/specialized-creation-office";

export const SPECIALIZED_CREATION_STORE_VERSION = 1 as const;
interface PersistedStore { readonly formatVersion:typeof SPECIALIZED_CREATION_STORE_VERSION; readonly projects:readonly SpecializedOfficeProject[]; }

export class FileSpecializedCreationStore {
  constructor(private readonly path:string) {}

  async list(forgeProjectId?:string):Promise<SpecializedOfficeProject[]> {
    const store=await this.load();
    return store.projects.filter(project=>!forgeProjectId||project.forgeProjectId===forgeProjectId).map(cloneProject).sort((a,b)=>a.id.localeCompare(b.id));
  }

  async get(forgeProjectId:string,id:string):Promise<SpecializedOfficeProject|undefined> {
    const project=(await this.load()).projects.find(item=>item.id===id&&item.forgeProjectId===forgeProjectId);
    return project?cloneProject(project):undefined;
  }

  async create(project:SpecializedOfficeProject):Promise<SpecializedOfficeProject> {
    validateSpecializedOfficeProject(project);
    const current=await this.load();
    if(current.projects.some(item=>item.id===project.id))throw new Error(`Specialized project id \"${project.id}\" already exists.`);
    await this.persist({formatVersion:SPECIALIZED_CREATION_STORE_VERSION,projects:[...current.projects,cloneProject(project)]});
    return cloneProject(project);
  }

  async save(project:SpecializedOfficeProject):Promise<SpecializedOfficeProject> {
    validateSpecializedOfficeProject(project);
    const current=await this.load();
    const index=current.projects.findIndex(item=>item.id===project.id&&item.forgeProjectId===project.forgeProjectId);
    if(index<0)throw new Error(`Specialized project \"${project.id}\" not found.`);
    const projects=[...current.projects];projects[index]=cloneProject(project);
    await this.persist({formatVersion:SPECIALIZED_CREATION_STORE_VERSION,projects});
    return cloneProject(project);
  }

  private async load():Promise<PersistedStore> {
    try {
      const parsed=JSON.parse(await readFile(this.path,"utf8")) as PersistedStore;
      if(parsed.formatVersion!==SPECIALIZED_CREATION_STORE_VERSION||!Array.isArray(parsed.projects))throw new Error("Unsupported specialized creation store format.");
      for(const project of parsed.projects){if(project.formatVersion!==SPECIALIZED_OFFICE_FORMAT_VERSION)throw new Error("Unsupported specialized project in store.");validateSpecializedOfficeProject(project);}
      return {formatVersion:SPECIALIZED_CREATION_STORE_VERSION,projects:parsed.projects.map(cloneProject)};
    } catch(error) {
      if(isMissing(error))return {formatVersion:SPECIALIZED_CREATION_STORE_VERSION,projects:[]};
      throw error;
    }
  }

  private async persist(store:PersistedStore):Promise<void> {
    await mkdir(dirname(this.path),{recursive:true});
    const temp=`${this.path}.tmp`;
    await writeFile(temp,`${JSON.stringify(store,null,2)}\n`,"utf8");
    await rename(temp,this.path);
  }
}

function cloneProject(project:SpecializedOfficeProject):SpecializedOfficeProject { return JSON.parse(JSON.stringify(project)) as SpecializedOfficeProject; }
function isMissing(error:unknown):boolean { return typeof error==="object"&&error!==null&&"code" in error&&(error as {code?:string}).code==="ENOENT"; }
