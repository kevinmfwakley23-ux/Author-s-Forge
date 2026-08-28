import { type EditingDocument, type EditorialReport, type EditorRole } from "../domain/intelligent-editing";
export interface EditingRequest {
    readonly document: EditingDocument;
    readonly roles: readonly EditorRole[];
    readonly reportId: string;
    readonly generatedAt?: string;
}
export declare class IntelligentEditingService {
    analyze(request: EditingRequest): EditorialReport;
    private analyzeRole;
}
