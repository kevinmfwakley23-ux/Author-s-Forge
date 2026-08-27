import {createProjectHealthReport,type ProjectHealthMetrics,type ProjectHealthReport} from "../domain/project-health";
export class ProjectHealthService { report(projectId:string,metrics:ProjectHealthMetrics,generatedAt?:string):ProjectHealthReport{return createProjectHealthReport({projectId,metrics,generatedAt});} }
