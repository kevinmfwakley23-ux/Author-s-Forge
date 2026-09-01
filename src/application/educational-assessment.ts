import { createEducationalRubric, scoreEducationalAssessment, type EducationalAssessmentRecord, type EducationalAssessmentScore, type EducationalResponseMode, type EducationalRubric, type EducationalRubricCriterion, type EducationalRubricLevel } from "../domain/educational-assessment";
import { FileEducationalAssessmentStore } from "../infrastructure/file-educational-assessment-store";

export class EducationalAssessmentService {
  constructor(private readonly store: FileEducationalAssessmentStore) {}

  async createRubric(input: {
    readonly id:string; readonly projectId:string; readonly title:string; readonly description?:string; readonly gradeBand:string;
    readonly standards?:readonly string[]; readonly allowedResponseModes?:readonly EducationalResponseMode[];
    readonly criteria:readonly EducationalRubricCriterion[]; readonly levels?:readonly EducationalRubricLevel[]; readonly now?:string;
  }):Promise<EducationalRubric>{
    const levels=input.levels?.length?input.levels:defaultLevels();
    return this.store.saveRubric(createEducationalRubric({...input,levels}));
  }

  async listRubrics(projectId:string):Promise<readonly EducationalRubric[]>{return this.store.listRubrics(projectId);}
  async getRubric(projectId:string,rubricId:string):Promise<EducationalRubric|undefined>{return this.store.getRubric(projectId,rubricId);}

  async score(input:{readonly id:string;readonly projectId:string;readonly rubricId:string;readonly activityOrTaskId:string;readonly responseMode:EducationalResponseMode;readonly scores:readonly EducationalAssessmentScore[];readonly feedback?:string;readonly now?:string;}):Promise<EducationalAssessmentRecord>{
    const rubric=await this.store.getRubric(input.projectId,input.rubricId);if(!rubric)throw new Error(`Educational rubric "${input.rubricId}" not found.`);
    return this.store.saveAssessment(scoreEducationalAssessment({...input,rubric}));
  }

  async listAssessments(projectId:string,rubricId?:string):Promise<readonly EducationalAssessmentRecord[]>{return this.store.listAssessments(projectId,rubricId);}
}

export function defaultLevels():readonly EducationalRubricLevel[]{return Object.freeze([
  Object.freeze({id:"emerging",label:"Emerging",score:1,description:"Evidence is incomplete or shows the skill is only beginning to develop."}),
  Object.freeze({id:"developing",label:"Developing",score:2,description:"Evidence shows partial understanding with important errors, omissions, or support still needed."}),
  Object.freeze({id:"proficient",label:"Proficient",score:3,description:"Evidence meets the stated learning objective accurately and independently for the assessed task."}),
  Object.freeze({id:"advanced",label:"Advanced",score:4,description:"Evidence exceeds the stated objective through strong reasoning, transfer, precision, or depth without merely adding more work."}),
]);}
