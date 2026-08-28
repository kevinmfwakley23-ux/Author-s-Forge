import type { MemoryAuthority, MemoryQuery, MemoryRecord } from "../domain/memory";
import { MEMORY_FORMAT_VERSION } from "../domain/memory";
export interface MemoryPromotionDecision {
    readonly memoryId: string;
    readonly from: MemoryAuthority;
    readonly to: MemoryAuthority;
    readonly actor: "author" | "system";
    readonly reason: string;
}
export interface ProjectMemorySnapshot {
    readonly formatVersion: typeof MEMORY_FORMAT_VERSION;
    readonly projectId: string;
    readonly memories: readonly MemoryRecord[];
}
export declare class ProjectMemoryStore {
    private readonly records;
    register(memory: MemoryRecord): void;
    get(memoryId: string): MemoryRecord | undefined;
    list(): MemoryRecord[];
    query(query?: MemoryQuery): MemoryRecord[];
    promote(memoryId: string, actor: MemoryPromotionDecision["actor"], reason: string): MemoryPromotionDecision;
    supersede(memoryId: string, replacementId: string, now?: string): MemoryRecord;
    toPortableState(): readonly MemoryRecord[];
    createSnapshot(projectId: string): ProjectMemorySnapshot;
    restore(records: readonly MemoryRecord[]): void;
    restoreSnapshot(snapshot: ProjectMemorySnapshot): void;
}
