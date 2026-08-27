import { calculateKdpCoverLayout, createBookCoverPlan, validateBookCoverFile, type BookCoverPlan, type CreateBookCoverPlanInput, type CoverValidationIssue } from "../domain/book-cover-studio";

export class BookCoverStudioService {
  private readonly plans = new Map<string, BookCoverPlan>();
  create(input: CreateBookCoverPlanInput): BookCoverPlan { const plan = createBookCoverPlan(input); if (this.plans.has(plan.id)) throw new Error(`Duplicate book cover plan id "${plan.id}".`); this.plans.set(plan.id, plan); return clone(plan); }
  get(id: string): BookCoverPlan | undefined { const plan = this.plans.get(id); return plan ? clone(plan) : undefined; }
  require(id: string): BookCoverPlan { const plan = this.get(id); if (!plan) throw new Error(`Book cover plan "${id}" not found.`); return plan; }
  calculate(input: CreateBookCoverPlanInput["publishing"]) { return calculateKdpCoverLayout(input); }
  validate(id: string, file: Parameters<typeof validateBookCoverFile>[1]): CoverValidationIssue[] { return validateBookCoverFile(this.require(id), file); }
  list(projectId?: string): BookCoverPlan[] { return [...this.plans.values()].filter((p) => projectId === undefined || p.projectId === projectId).sort((a,b) => a.id.localeCompare(b.id)).map(clone); }
}
function clone(plan: BookCoverPlan): BookCoverPlan { return { ...plan, publishing: { ...plan.publishing }, dimensions: { ...plan.dimensions }, zones: { ...plan.zones, front: {...plan.zones.front}, spine: {...plan.zones.spine}, back: {...plan.zones.back}, barcodeSafeArea: {...plan.zones.barcodeSafeArea}, trim: {...plan.zones.trim} } }; }
