import { type IllustrationAssetLibraryState } from "../domain/illustration-asset-library";
export declare class FileIllustrationAssetLibraryStore {
    private readonly rootDirectory;
    constructor(rootDirectory: string);
    save(state: IllustrationAssetLibraryState): Promise<void>;
    load(projectId: string): Promise<IllustrationAssetLibraryState | null>;
    exists(projectId: string): Promise<boolean>;
    private path;
    private assertProjectId;
}
