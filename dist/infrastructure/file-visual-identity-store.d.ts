import type { VisualCharacterIdentity } from "../domain/character-visual-continuity";
export declare class FileVisualIdentityStore {
    private readonly rootDirectory;
    constructor(rootDirectory: string);
    save(projectId: string, identities: readonly VisualCharacterIdentity[]): Promise<void>;
    load(projectId: string): Promise<readonly VisualCharacterIdentity[]>;
    exists(projectId: string): Promise<boolean>;
    private validateCollection;
    private identityPath;
    private assertProjectId;
}
