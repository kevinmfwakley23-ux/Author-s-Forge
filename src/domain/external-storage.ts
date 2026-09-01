export const EXTERNAL_STORAGE_FORMAT_VERSION = 1 as const;
export const STORAGE_PROVIDER_IDS = Object.freeze(["local", "google-drive", "onedrive", "dropbox", "icloud", "download"] as const);
export type StorageProviderId = (typeof STORAGE_PROVIDER_IDS)[number];
export interface StoredObject { readonly key:string; readonly size:number; readonly mediaType:string; readonly updatedAt:string; readonly etag?:string; }
export interface StorageProvider { readonly id:StorageProviderId; put(key:string,content:Uint8Array,mediaType:string):Promise<StoredObject>; get(key:string):Promise<Uint8Array>; delete(key:string):Promise<void>; list(prefix?:string):Promise<readonly StoredObject[]>; }
export interface ProjectStorageBinding { readonly formatVersion:typeof EXTERNAL_STORAGE_FORMAT_VERSION; readonly projectId:string; readonly providerId:StorageProviderId; readonly keyPrefix:string; readonly sourceOfTruth:"forge-project"; }

function text(value:unknown,label:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required.`);return value.trim();}

export function isStorageProviderId(value:unknown):value is StorageProviderId{return typeof value==="string"&&(STORAGE_PROVIDER_IDS as readonly string[]).includes(value);}

export function validateForgeProjectId(value:unknown,label="Project id"):string{const id=text(value,label);if(!/^[A-Za-z0-9_-]+$/.test(id))throw new Error(`${label} contains unsupported characters.`);return id;}

export function normalizeStorageKey(value:unknown,label="Storage key",allowEmpty=false):string{
  if(allowEmpty&&(value===undefined||value===""))return"";
  const key=text(value,label);
  if(key.startsWith("/")||key.endsWith("/")||key.includes("\\")||/[\u0000-\u001F\u007F]/.test(key))throw new Error(`${label} must be a normalized relative storage path.`);
  const segments=key.split("/");
  if(segments.some(segment=>!segment||segment==="."||segment===".."||segment!==segment.trim()))throw new Error(`${label} must be a normalized relative storage path.`);
  return segments.join("/");
}

export function validateStoredObject(value:unknown):StoredObject{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Stored object metadata must be an object.");
  const input=value as Record<string,unknown>;
  const key=normalizeStorageKey(input.key,"Stored object key");
  if(typeof input.size!=="number"||!Number.isSafeInteger(input.size)||input.size<0)throw new Error("Stored object size must be a non-negative safe integer.");
  const mediaType=text(input.mediaType,"Stored object media type");
  const updatedAt=text(input.updatedAt,"Stored object updatedAt");
  if(Number.isNaN(Date.parse(updatedAt)))throw new Error("Stored object updatedAt must be a valid timestamp.");
  const etag=input.etag===undefined?undefined:text(input.etag,"Stored object etag");
  return etag===undefined?{key,size:input.size,mediaType,updatedAt}:{key,size:input.size,mediaType,updatedAt,etag};
}

export function createProjectStorageBinding(input:{projectId:string;providerId:StorageProviderId;keyPrefix?:string}):ProjectStorageBinding{
  if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Project storage binding input must be an object.");
  const projectId=validateForgeProjectId(input.projectId);
  if(!isStorageProviderId(input.providerId))throw new Error("Unsupported storage provider id.");
  const keyPrefix=normalizeStorageKey(input.keyPrefix??`projects/${projectId}`,"Storage key prefix");
  return{formatVersion:EXTERNAL_STORAGE_FORMAT_VERSION,projectId,providerId:input.providerId,keyPrefix,sourceOfTruth:"forge-project"};
}

export function validateProjectStorageBinding(binding:ProjectStorageBinding):ProjectStorageBinding{
  if(!binding||typeof binding!=="object"||Array.isArray(binding))throw new Error("Project storage binding must be an object.");
  if(binding.formatVersion!==EXTERNAL_STORAGE_FORMAT_VERSION)throw new Error("Unsupported external storage binding version.");
  const projectId=validateForgeProjectId(binding.projectId);
  if(!isStorageProviderId(binding.providerId))throw new Error("Unsupported storage provider id.");
  const keyPrefix=normalizeStorageKey(binding.keyPrefix,"Storage key prefix");
  if(binding.sourceOfTruth!=="forge-project")throw new Error("Forge project must remain the source of truth.");
  return{formatVersion:EXTERNAL_STORAGE_FORMAT_VERSION,projectId,providerId:binding.providerId,keyPrefix,sourceOfTruth:"forge-project"};
}

export function createDownloadableProjectPackageFilename(projectId:string):string{return`${validateForgeProjectId(projectId)}.forge-project.json`;}

export class MemoryStorageProvider implements StorageProvider{
  readonly id="download" as const;
  private readonly objects=new Map<string,{bytes:Uint8Array;mediaType:string;updatedAt:string}>();
  async put(key:string,content:Uint8Array,mediaType:string){const normalized=normalizeStorageKey(key);if(!(content instanceof Uint8Array))throw new Error("Storage content must be Uint8Array bytes.");const value={bytes:new Uint8Array(content),mediaType:text(mediaType,"Media type"),updatedAt:new Date().toISOString()};this.objects.set(normalized,value);return{key:normalized,size:value.bytes.byteLength,mediaType:value.mediaType,updatedAt:value.updatedAt};}
  async get(key:string){const normalized=normalizeStorageKey(key);const value=this.objects.get(normalized);if(!value)throw new Error(`Storage object "${normalized}" was not found.`);return new Uint8Array(value.bytes);}
  async delete(key:string){this.objects.delete(normalizeStorageKey(key));}
  async list(prefix=""){const normalized=normalizeStorageKey(prefix,"Storage list prefix",true);return[...this.objects.entries()].filter(([key])=>!normalized||key===normalized||key.startsWith(`${normalized}/`)).map(([key,v])=>({key,size:v.bytes.byteLength,mediaType:v.mediaType,updatedAt:v.updatedAt}));}
}
