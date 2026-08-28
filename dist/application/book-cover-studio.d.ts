import { validateBookCoverFile, type BookCoverPlan, type CreateBookCoverPlanInput, type CoverValidationIssue } from "../domain/book-cover-studio";
export declare class BookCoverStudioService {
    private readonly plans;
    create(input: CreateBookCoverPlanInput): BookCoverPlan;
    get(id: string): BookCoverPlan | undefined;
    require(id: string): BookCoverPlan;
    calculate(input: CreateBookCoverPlanInput["publishing"]): {
        dimensions: import("../domain/book-cover-studio").CoverDimensions;
        zones: import("../domain/book-cover-studio").CoverZones;
    };
    validate(id: string, file: Parameters<typeof validateBookCoverFile>[1]): CoverValidationIssue[];
    list(projectId?: string): BookCoverPlan[];
}
