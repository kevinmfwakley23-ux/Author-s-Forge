export declare const PROJECT_PACKAGE_FORMAT_VERSION: 1;
export declare const PROJECT_PACKAGE_NAME: "AUTHOR'S FORGE PROJECT";
export type ProjectPackageEncoding = "utf8" | "base64";
export interface ProjectPackageManifest {
    readonly formatVersion: typeof PROJECT_PACKAGE_FORMAT_VERSION;
    readonly packageName: typeof PROJECT_PACKAGE_NAME;
    readonly projectId: string;
    readonly exportedAt: string;
    readonly paths: readonly string[];
}
export interface ForgeProjectPackage {
    readonly manifest: ProjectPackageManifest;
    readonly projectState: unknown;
    readonly files: readonly ProjectPackageFile[];
}
export interface ProjectPackageFile {
    readonly path: string;
    readonly content: string;
    readonly encoding: ProjectPackageEncoding;
    readonly mediaType: string;
    readonly sha256: string;
}
export declare function createProjectPackage(input: {
    projectId: string;
    projectState: unknown;
    files?: readonly ProjectPackageFile[];
    exportedAt?: string;
}): ForgeProjectPackage;
export declare function validateProjectPackage(pkg: ForgeProjectPackage): ForgeProjectPackage;
export declare function serializeProjectPackage(pkg: ForgeProjectPackage): string;
export declare function deserializeProjectPackage(serialized: string): ForgeProjectPackage;
