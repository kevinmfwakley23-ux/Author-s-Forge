import type { ProjectStorageBinding, StorageProvider, StoredObject } from "../domain/external-storage";
export declare class ExternalStorageService {
    private readonly provider;
    constructor(provider: StorageProvider);
    getProviderId(): import("../domain/external-storage").StorageProviderId;
    bind(binding: ProjectStorageBinding): ProjectStorageBinding;
    put(binding: ProjectStorageBinding, key: string, content: Uint8Array, mediaType: string): Promise<StoredObject>;
    get(binding: ProjectStorageBinding, key: string): Promise<Uint8Array>;
    list(binding: ProjectStorageBinding, prefix?: string): Promise<readonly StoredObject[]>;
}
