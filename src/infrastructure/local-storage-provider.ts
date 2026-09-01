import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { normalizeStorageKey } from "../domain/external-storage";
import type { StorageProvider, StoredObject } from "../domain/external-storage";

export class LocalFileStorageProvider implements StorageProvider {
  readonly id="local" as const;
  constructor(private readonly rootDirectory:string){this.rootDirectory=resolve(rootDirectory);}

  private normalizedKey(key:string,allowRoot=false):string{return normalizeStorageKey(key,"Storage key",allowRoot);}
  private pathForNormalized(normalized:string):string{const path=resolve(this.rootDirectory,normalized);if(path!==this.rootDirectory&&!path.startsWith(`${this.rootDirectory}/`))throw new Error("Storage key escapes provider root.");return path;}
  private pathFor(key:string,allowRoot=false):{normalized:string;path:string}{const normalized=this.normalizedKey(key,allowRoot);return{normalized,path:this.pathForNormalized(normalized)};}

  async put(key:string,content:Uint8Array,mediaType:string):Promise<StoredObject>{const{normalized,path}=this.pathFor(key);await fs.mkdir(dirname(path),{recursive:true});await fs.writeFile(path,content);const stat=await fs.stat(path);return{key:normalized,size:stat.size,mediaType,updatedAt:stat.mtime.toISOString()};}
  async get(key:string):Promise<Uint8Array>{return new Uint8Array(await fs.readFile(this.pathFor(key).path));}
  async delete(key:string):Promise<void>{await fs.rm(this.pathFor(key).path,{force:true});}
  async list(prefix=""):Promise<readonly StoredObject[]>{const{path:root}=this.pathFor(prefix,true);const result:StoredObject[]=[];const walk=async(dir:string)=>{let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return;throw error;}for(const entry of entries){const full=join(dir,entry.name);if(entry.isDirectory())await walk(full);else{const stat=await fs.stat(full);const key=full.slice(this.rootDirectory.length+1).split("\\").join("/");result.push({key,size:stat.size,mediaType:"application/octet-stream",updatedAt:stat.mtime.toISOString()});}}};await walk(root);return result;}
}
