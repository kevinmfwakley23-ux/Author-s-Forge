import { type ProjectHealthMetrics, type ProjectHealthReport } from "../domain/project-health";
export declare class ProjectHealthService {
    report(projectId: string, metrics: ProjectHealthMetrics, generatedAt?: string): ProjectHealthReport;
}
