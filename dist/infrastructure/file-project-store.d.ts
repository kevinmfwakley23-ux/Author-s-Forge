import type { ProjectState } from "../domain/project";
export declare class FileProjectStore {
    private readonly rootDirectory;
    constructor(rootDirectory: string);
    create(project: ProjectState): Promise<void>;
    load(projectId: string): Promise<ProjectState | null>;
    save(project: ProjectState): Promise<void>;
    exists(projectId: string): Promise<boolean>;
    private projectPath;
    private validate;
}
