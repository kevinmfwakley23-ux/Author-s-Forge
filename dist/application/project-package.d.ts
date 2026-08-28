import type { ForgeProjectPackage, ProjectPackageFile } from "../domain/project-package";
export declare class ProjectPackageService {
    export(input: {
        projectId: string;
        projectState: unknown;
        files?: readonly ProjectPackageFile[];
        exportedAt?: string;
    }): ForgeProjectPackage;
    serialize(pkg: ForgeProjectPackage): string;
    import(serialized: string): ForgeProjectPackage;
    validate(pkg: ForgeProjectPackage): ForgeProjectPackage;
}
