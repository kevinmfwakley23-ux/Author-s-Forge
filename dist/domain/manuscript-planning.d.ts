import type { ManuscriptState } from "./manuscript";
export declare const MANUSCRIPT_PLAN_FORMAT_VERSION: 1;
export type PlanTargetType = "book" | "chapter" | "scene";
export type PlanLifecycle = "planned" | "working" | "locked" | "superseded" | "archived";
export interface ManuscriptPlan {
    readonly id: string;
    readonly projectId: string;
    readonly targetType: PlanTargetType;
    readonly targetId: string;
    readonly version: number;
    readonly lifecycle: PlanLifecycle;
    readonly purpose: string;
    readonly summary: string;
    readonly beats: readonly string[];
    readonly constraints: readonly string[];
    readonly openQuestions: readonly string[];
    readonly supersedesPlanId: string | null;
}
export interface ManuscriptPlanningState {
    readonly formatVersion: typeof MANUSCRIPT_PLAN_FORMAT_VERSION;
    readonly plans: readonly ManuscriptPlan[];
}
export declare function createManuscriptPlanningState(): ManuscriptPlanningState;
export declare function createManuscriptPlan(input: {
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
    supersedesPlanId?: string | null;
}): ManuscriptPlan;
export declare function addManuscriptPlan(state: ManuscriptPlanningState, manuscript: ManuscriptState, plan: ManuscriptPlan): ManuscriptPlanningState;
export declare function replaceManuscriptPlan(state: ManuscriptPlanningState, manuscript: ManuscriptState, plan: ManuscriptPlan): ManuscriptPlanningState;
export declare function getCurrentManuscriptPlan(state: ManuscriptPlanningState, manuscript: ManuscriptState, targetType: PlanTargetType, targetId: string): ManuscriptPlan | null;
export declare function validateManuscriptPlanningState(state: ManuscriptPlanningState, manuscript: ManuscriptState): void;
