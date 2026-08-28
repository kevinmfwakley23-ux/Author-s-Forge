import { type PublishingReadinessInput, type PublishingReadinessReport } from "../domain/publishing-readiness";
export interface PublishingReadinessStore {
    save(report: PublishingReadinessReport): void;
    get(id: string): PublishingReadinessReport | undefined;
    list(projectId: string): readonly PublishingReadinessReport[];
}
export declare class PublishingReadinessService {
    private readonly store?;
    constructor(store?: PublishingReadinessStore | undefined);
    audit(input: PublishingReadinessInput & {
        id: string;
        projectId: string;
        now?: string;
    }): PublishingReadinessReport;
    get(id: string): PublishingReadinessReport | undefined;
    list(projectId: string): readonly PublishingReadinessReport[];
    validate(report: PublishingReadinessReport): PublishingReadinessReport;
}
