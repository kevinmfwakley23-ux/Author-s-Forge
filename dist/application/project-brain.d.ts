import type { MemoryClass, MemoryRecord } from "../domain/memory";
import type { ProjectMemoryStore } from "./project-memory-store";
export interface ProjectBrainQuery {
    readonly projectId: string;
    readonly taskMemoryClasses?: readonly MemoryClass[];
    readonly relevanceTags?: readonly string[];
    readonly includeWorkingState?: boolean;
    readonly changedSince?: string;
    readonly limit?: number;
}
export interface ProjectBrainContext {
    readonly projectId: string;
    readonly authoritative: readonly MemoryRecord[];
    readonly working: readonly MemoryRecord[];
    readonly changed: readonly MemoryRecord[];
}
export declare function assembleProjectBrainContext(store: ProjectMemoryStore, query: ProjectBrainQuery): ProjectBrainContext;
