import type { ProjectState } from "./project";
export declare const CONTEXT_ASSEMBLY_FORMAT_VERSION: 1;
export declare const CONTEXT_INCLUSION_MODES: readonly ["full", "brief", "extended", "custom", "off"];
export type ContextInclusionMode = typeof CONTEXT_INCLUSION_MODES[number];
export interface ContextSectionPolicy {
    readonly key: string;
    readonly mode: ContextInclusionMode;
    readonly maxWords?: number;
}
export interface ContextAssemblyRequest {
    readonly projectId: string;
    readonly policies?: readonly ContextSectionPolicy[];
    readonly query?: string;
    readonly characterIds?: readonly string[];
}
export interface ContextSection {
    readonly key: string;
    readonly title: string;
    readonly mode: ContextInclusionMode;
    readonly text: string;
    readonly sourceIds: readonly string[];
    readonly wordCount: number;
}
export interface AssembledWritingContext {
    readonly formatVersion: typeof CONTEXT_ASSEMBLY_FORMAT_VERSION;
    readonly projectId: string;
    readonly sections: readonly ContextSection[];
    readonly totalWords: number;
    readonly sourceIds: readonly string[];
}
export declare function assembleWritingContext(project: ProjectState, request: ContextAssemblyRequest): AssembledWritingContext;
