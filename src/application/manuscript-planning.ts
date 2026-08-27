import type { ManuscriptState } from "../domain/manuscript";
import {
  addManuscriptPlan,
  createManuscriptPlan,
  createManuscriptPlanningState,
  getCurrentManuscriptPlan,
  replaceManuscriptPlan,
  validateManuscriptPlanningState,
  type ManuscriptPlan,
  type ManuscriptPlanningState,
  type PlanLifecycle,
  type PlanTargetType
} from "../domain/manuscript-planning";

export class ManuscriptPlanningService {
  constructor(private readonly manuscript: ManuscriptState, private state: ManuscriptPlanningState = createManuscriptPlanningState()) {
    validateManuscriptPlanningState(this.state, this.manuscript);
  }

  create(input: {
    id: string; projectId: string; targetType: PlanTargetType; targetId: string; version?: number;
    lifecycle?: PlanLifecycle; purpose: string; summary: string; beats?: readonly string[];
    constraints?: readonly string[]; openQuestions?: readonly string[];
  }): ManuscriptPlan {
    const plan = createManuscriptPlan(input);
    this.state = addManuscriptPlan(this.state, this.manuscript, plan);
    return plan;
  }

  replace(input: {
    id: string; projectId: string; targetType: PlanTargetType; targetId: string; version: number;
    lifecycle?: PlanLifecycle; purpose: string; summary: string; beats?: readonly string[];
    constraints?: readonly string[]; openQuestions?: readonly string[];
  }): ManuscriptPlan {
    const previous = getCurrentManuscriptPlan(this.state, this.manuscript, input.targetType, input.targetId);
    if (!previous) throw new Error(`No current plan exists for ${input.targetType} "${input.targetId}".`);
    const plan = createManuscriptPlan({ ...input, supersedesPlanId: previous.id });
    this.state = replaceManuscriptPlan(this.state, this.manuscript, plan);
    return plan;
  }

  current(targetType: PlanTargetType, targetId: string): ManuscriptPlan | null {
    return getCurrentManuscriptPlan(this.state, this.manuscript, targetType, targetId);
  }

  snapshot(): ManuscriptPlanningState {
    return { formatVersion: this.state.formatVersion, plans: this.state.plans.map((plan) => ({ ...plan, beats: [...plan.beats], constraints: [...plan.constraints], openQuestions: [...plan.openQuestions] })) };
  }
}
