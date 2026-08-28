import type { ManuscriptState } from "../domain/manuscript";
import { type ManuscriptPlan, type ManuscriptPlanningState, type PlanLifecycle, type PlanTargetType } from "../domain/manuscript-planning";
export declare class ManuscriptPlanningService {
    private readonly manuscript;
    private state;
    constructor(manuscript: ManuscriptState, state?: ManuscriptPlanningState);
    create(input: {
        id: string;
        projectId: string;
        targetType: PlanTargetType;
        targetId: string;
        version?: number;
        lifecycle?: PlanLifecycle;
        purpose: string;
        summary: string;
        beats?: readonly string[];
        constraints?: readonly string[];
        openQuestions?: readonly string[];
    }): ManuscriptPlan;
    replace(input: {
        id: string;
        projectId: string;
        targetType: PlanTargetType;
        targetId: string;
        version: number;
        lifecycle?: PlanLifecycle;
        purpose: string;
        summary: string;
        beats?: readonly string[];
        constraints?: readonly string[];
        openQuestions?: readonly string[];
    }): ManuscriptPlan;
    current(targetType: PlanTargetType, targetId: string): ManuscriptPlan | null;
    snapshot(): ManuscriptPlanningState;
}
