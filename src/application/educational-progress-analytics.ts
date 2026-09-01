import { buildEducationalProgressAnalytics, type EducationalProgressAnalyticsReport } from "../domain/educational-progress-analytics";
import { FileEducationalAssessmentStore } from "../infrastructure/file-educational-assessment-store";

export class EducationalProgressAnalyticsService {
  constructor(private readonly store: FileEducationalAssessmentStore) {}
  async report(projectId: string, now?: string): Promise<EducationalProgressAnalyticsReport> {
    const [rubrics, records] = await Promise.all([this.store.listRubrics(projectId), this.store.listAssessments(projectId)]);
    return buildEducationalProgressAnalytics({ projectId, rubrics, records, ...(now ? { now } : {}) });
  }
}
