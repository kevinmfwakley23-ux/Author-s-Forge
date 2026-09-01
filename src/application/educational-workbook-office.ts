import {
  createWorkbookActivity,
  generateEducationalWorkbook,
  type EducationalWorkbookGenerationRequest,
  type EducationalWorkbookPlan,
  type WorkbookActivity,
  type WorkbookActivityInput,
} from "../domain/educational-workbook";
import { FileEducationalWorkbookStore } from "../infrastructure/file-educational-workbook-store";

export type CreateEducationalWorkbookRequest = Omit<EducationalWorkbookGenerationRequest, "activityLibrary">;

/** Application boundary for the Educational Workbook Office. */
export class EducationalWorkbookOfficeService {
  constructor(private readonly store: FileEducationalWorkbookStore) {}

  async listActivities(projectId: string): Promise<readonly WorkbookActivity[]> {
    return this.store.listActivities(required(projectId, "Project id"));
  }

  async createActivity(input: WorkbookActivityInput): Promise<WorkbookActivity> {
    const activity = createWorkbookActivity(input);
    await this.store.upsertActivities(activity.projectId, [activity]);
    return activity;
  }

  async importActivities(projectId: string, inputs: readonly Omit<WorkbookActivityInput, "projectId">[]): Promise<readonly WorkbookActivity[]> {
    const project = required(projectId, "Project id");
    if (!Array.isArray(inputs) || !inputs.length) throw new Error("Educational Workbook import requires at least one activity.");
    const activities = inputs.map((input) => createWorkbookActivity({ ...input, projectId: project }));
    return this.store.upsertActivities(project, activities);
  }

  async removeActivity(projectId: string, activityId: string): Promise<boolean> {
    return this.store.removeActivity(required(projectId, "Project id"), required(activityId, "Activity id"));
  }

  async createWorkbook(request: CreateEducationalWorkbookRequest): Promise<EducationalWorkbookPlan> {
    const library = await this.store.listActivities(required(request.projectId, "Project id"));
    const workbook = generateEducationalWorkbook({ ...request, activityLibrary: library });
    return this.store.saveWorkbook(workbook);
  }

  async listWorkbooks(projectId: string): Promise<readonly EducationalWorkbookPlan[]> {
    return this.store.listWorkbooks(required(projectId, "Project id"));
  }

  async getWorkbook(projectId: string, workbookId: string): Promise<EducationalWorkbookPlan | undefined> {
    return this.store.getWorkbook(required(projectId, "Project id"), required(workbookId, "Workbook id"));
  }
}

function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}
