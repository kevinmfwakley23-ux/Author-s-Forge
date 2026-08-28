import { type ProductionArtifact, type ProductionManuscript, type ProductionOptions } from "../domain/manuscript-production";
export declare class ManuscriptProductionService {
    render(manuscript: ProductionManuscript, options: ProductionOptions, now?: string): ProductionArtifact;
    validate(artifact: ProductionArtifact): import("../domain/manuscript-production").ProductionValidationIssue[];
}
