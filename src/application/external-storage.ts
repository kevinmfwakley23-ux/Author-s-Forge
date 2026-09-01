import { normalizeStorageKey, validateProjectStorageBinding } from "../domain/external-storage";
import type { ProjectStorageBinding, StorageProvider, StoredObject } from "../domain/external-storage";

export class ExternalStorageService {
  constructor(private readonly provider:StorageProvider){}
  getProviderId(){return this.provider.id;}
  bind(binding:ProjectStorageBinding):ProjectStorageBinding{const validated=validateProjectStorageBinding(binding);if(validated.providerId!==this.provider.id)throw new Error("Storage binding provider does not match the configured provider.");return validated;}
  async put(binding:ProjectStorageBinding,key:string,content:Uint8Array,mediaType:string):Promise<StoredObject>{const validated=this.bind(binding);return this.provider.put(scopedKey(validated,key),content,mediaType);}
  async get(binding:ProjectStorageBinding,key:string):Promise<Uint8Array>{const validated=this.bind(binding);return this.provider.get(scopedKey(validated,key));}
  async delete(binding:ProjectStorageBinding,key:string):Promise<void>{const validated=this.bind(binding);await this.provider.delete(scopedKey(validated,key));}
  async list(binding:ProjectStorageBinding,prefix=""):Promise<readonly StoredObject[]>{
    const validated=this.bind(binding);
    const scoped=scopedPrefix(validated,prefix);
    const listed=await this.provider.list(scoped);
    return listed.filter((item)=>item.key===scoped||item.key.startsWith(`${scoped}/`));
  }
}

function scopedKey(binding:ProjectStorageBinding,key:unknown):string{return`${binding.keyPrefix}/${normalizeStorageKey(key,"Storage object key")}`;}
function scopedPrefix(binding:ProjectStorageBinding,prefix:unknown):string{const normalized=normalizeStorageKey(prefix,"Storage list prefix",true);return normalized?`${binding.keyPrefix}/${normalized}`:binding.keyPrefix;}
