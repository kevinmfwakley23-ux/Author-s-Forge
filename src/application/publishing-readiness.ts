import { createPublishingReadinessReport, validatePublishingReadinessReport, type PublishingReadinessInput, type PublishingReadinessReport } from "../domain/publishing-readiness";
export interface PublishingReadinessStore { save(report: PublishingReadinessReport): void; get(id: string): PublishingReadinessReport | undefined; list(projectId: string): readonly PublishingReadinessReport[]; }
export class PublishingReadinessService {
  constructor(private readonly store?: PublishingReadinessStore) {}
  audit(input: PublishingReadinessInput & { id: string; projectId: string; now?: string }): PublishingReadinessReport { const report = createPublishingReadinessReport(input); if (this.store) this.store.save(report); return report; }
  get(id: string): PublishingReadinessReport | undefined { return this.store?.get(id); }
  list(projectId: string): readonly PublishingReadinessReport[] { return this.store?.list(projectId) ?? []; }
  validate(report: PublishingReadinessReport): PublishingReadinessReport { return validatePublishingReadinessReport(report); }
}
