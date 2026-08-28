export declare const PROJECT_HEALTH_FORMAT_VERSION: 1;
export interface ProjectHealthMetrics {
    readonly bookCompletionPercent: number;
    readonly chaptersComplete: number;
    readonly chaptersTotal: number;
    readonly wordCount: number;
    readonly wordCountTarget?: number;
    readonly criticalCanonConflicts: number;
    readonly minorCanonConflicts: number;
    readonly unresolvedPlotThreads: number;
    readonly characters: number;
    readonly locations: number;
    readonly researchSources: number;
    readonly illustrations: number;
    readonly coverStatus: string;
    readonly marketingCompletionPercent: number;
    readonly publishingReadinessPercent: number;
}
export interface ProjectHealthReport {
    readonly formatVersion: typeof PROJECT_HEALTH_FORMAT_VERSION;
    readonly projectId: string;
    readonly generatedAt: string;
    readonly metrics: ProjectHealthMetrics;
    readonly status: "healthy" | "attention" | "blocked";
}
export declare function createProjectHealthReport(input: {
    projectId: string;
    metrics: ProjectHealthMetrics;
    generatedAt?: string;
}): ProjectHealthReport;
export declare function validateProjectHealthReport(r: ProjectHealthReport): ProjectHealthReport;
