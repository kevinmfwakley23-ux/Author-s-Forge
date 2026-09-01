import { normalizeStorageKey, validateProjectStorageBinding, validateStoredObject } from "../domain/external-storage";
import type { ProjectStorageBinding, StorageProvider, StoredObject } from "../domain/external-storage";

export class ExternalStorageService {
  constructor(private readonly provider:StorageProvider){}
  getProviderId(){return this.provider.id;}
  bind(binding:ProjectStorageBinding):ProjectStorageBinding{const validated=validateProjectStorageBinding(binding);if(validated.providerId!==this.provider.id)throw new Error("Storage binding provider does not match the configured provider.");return validated;}
  async put(binding:ProjectStorageBinding,key:string,content:Uint8Array,mediaType:string):Promise<StoredObject>{
    const validated=this.bind(binding);
    const expected=scopedKey(validated,key);
    const stored=validateStoredObject(await this.provider.put(expected,content,mediaType));
    if(stored.key!==expected)throw new Error("Storage provider returned metadata outside the requested project object key.");
    return stored;
  }
  async get(binding:ProjectStorageBinding,key:string):Promise<Uint8Array>{const validated=this.bind(binding);const bytes=await this.provider.get(scopedKey(validated,key));if(!(bytes instanceof Uint8Array))throw new Error("Storage provider returned non-byte content.");return bytes;}
  async delete(binding:ProjectStorageBinding,key:string):Promise<void>{const validated=this.bind(binding);await this.provider.delete(scopedKey(validated,key));}
  async list(binding:ProjectStorageBinding,prefix=""):Promise<readonly StoredObject[]>{
    const validated=this.bind(binding);
    const scoped=scopedPrefix(validated,prefix);
    const raw=await this.provider.list(scoped);
    if(!Array.isArray(raw))throw new Error("Storage provider list result must be an array.");
    const listed=raw.map((item)=>validateStoredObject(item));
    if(listed.some((item)=>item.key!==scoped&&!item.key.startsWith(`${scoped}/`)))throw new Error("Storage provider returned metadata outside the requested project namespace.");
    return listed;
  }
}

function scopedKey(binding:ProjectStorageBinding,key:unknown):string{return`${binding.keyPrefix}/${normalizeStorageKey(key,"Storage object key")}`;}
function scopedPrefix(binding:ProjectStorageBinding,prefix:unknown):string{const normalized=normalizeStorageKey(prefix,"Storage list prefix",true);return normalized?`${binding.keyPrefix}/${normalized}`:binding.keyPrefix;}
