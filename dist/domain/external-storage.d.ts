export declare const EXTERNAL_STORAGE_FORMAT_VERSION: 1;
export type StorageProviderId = "local" | "google-drive" | "onedrive" | "dropbox" | "icloud" | "download";
export interface StoredObject {
    readonly key: string;
    readonly size: number;
    readonly mediaType: string;
    readonly updatedAt: string;
    readonly etag?: string;
}
export interface StorageProvider {
    readonly id: StorageProviderId;
    put(key: string, content: Uint8Array, mediaType: string): Promise<StoredObject>;
    get(key: string): Promise<Uint8Array>;
    delete(key: string): Promise<void>;
    list(prefix?: string): Promise<readonly StoredObject[]>;
}
export interface ProjectStorageBinding {
    readonly formatVersion: typeof EXTERNAL_STORAGE_FORMAT_VERSION;
    readonly projectId: string;
    readonly providerId: StorageProviderId;
    readonly keyPrefix: string;
    readonly sourceOfTruth: "forge-project";
}
export declare function createProjectStorageBinding(input: {
    projectId: string;
    providerId: StorageProviderId;
    keyPrefix?: string;
}): ProjectStorageBinding;
export declare function validateProjectStorageBinding(binding: ProjectStorageBinding): ProjectStorageBinding;
export declare function createDownloadableProjectPackageFilename(projectId: string): string;
export declare class MemoryStorageProvider implements StorageProvider {
    readonly id: "download";
    private readonly objects;
    put(key: string, content: Uint8Array, mediaType: string): Promise<{
        key: string;
        size: number;
        mediaType: string;
        updatedAt: string;
    }>;
    get(key: string): Promise<Uint8Array<ArrayBuffer>>;
    delete(key: string): Promise<void>;
    list(prefix?: string): Promise<{
        key: string;
        size: number;
        mediaType: string;
        updatedAt: string;
    }[]>;
}
