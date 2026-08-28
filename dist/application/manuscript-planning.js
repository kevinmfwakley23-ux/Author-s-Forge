"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManuscriptPlanningService = void 0;
const manuscript_planning_1 = require("../domain/manuscript-planning");
class ManuscriptPlanningService {
    manuscript;
    state;
    constructor(manuscript, state = (0, manuscript_planning_1.createManuscriptPlanningState)()) {
        this.manuscript = manuscript;
        this.state = state;
        (0, manuscript_planning_1.validateManuscriptPlanningState)(this.state, this.manuscript);
    }
    create(input) {
        const plan = (0, manuscript_planning_1.createManuscriptPlan)(input);
        this.state = (0, manuscript_planning_1.addManuscriptPlan)(this.state, this.manuscript, plan);
        return plan;
    }
    replace(input) {
        const previous = (0, manuscript_planning_1.getCurrentManuscriptPlan)(this.state, this.manuscript, input.targetType, input.targetId);
        if (!previous)
            throw new Error(`No current plan exists for ${input.targetType} "${input.targetId}".`);
        const plan = (0, manuscript_planning_1.createManuscriptPlan)({ ...input, supersedesPlanId: previous.id });
        this.state = (0, manuscript_planning_1.replaceManuscriptPlan)(this.state, this.manuscript, plan);
        return plan;
    }
    current(targetType, targetId) {
        return (0, manuscript_planning_1.getCurrentManuscriptPlan)(this.state, this.manuscript, targetType, targetId);
    }
    snapshot() {
        return { formatVersion: this.state.formatVersion, plans: this.state.plans.map((plan) => ({ ...plan, beats: [...plan.beats], constraints: [...plan.constraints], openQuestions: [...plan.openQuestions] })) };
    }
}
exports.ManuscriptPlanningService = ManuscriptPlanningService;
//# sourceMappingURL=manuscript-planning.js.map