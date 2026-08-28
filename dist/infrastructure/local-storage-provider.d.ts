import type { StorageProvider, StoredObject } from "../domain/external-storage";
export declare class LocalFileStorageProvider implements StorageProvider {
    private readonly rootDirectory;
    readonly id: "local";
    constructor(rootDirectory: string);
    private pathFor;
    put(key: string, content: Uint8Array, mediaType: string): Promise<StoredObject>;
    get(key: string): Promise<Uint8Array>;
    delete(key: string): Promise<void>;
    list(prefix?: string): Promise<readonly StoredObject[]>;
}
