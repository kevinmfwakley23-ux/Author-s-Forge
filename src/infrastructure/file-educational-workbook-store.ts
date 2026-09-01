import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  validateEducationalWorkbookPlan,
  validateWorkbookActivity,
  type EducationalWorkbookPlan,
  type WorkbookActivity,
} from "../domain/educational-workbook";

export const EDUCATIONAL_WORKBOOK_STORE_FORMAT_VERSION = 1 as const;

interface PersistedEducationalWorkbookState {
  readonly formatVersion: typeof EDUCATIONAL_WORKBOOK_STORE_FORMAT_VERSION;
  readonly activities: readonly WorkbookActivity[];
  readonly workbooks: readonly EducationalWorkbookPlan[];
}

/** Durable project-scoped store for Educational Workbook activity libraries and generated editions. */
export class FileEducationalWorkbookStore {
  private activities: WorkbookActivity[] = [];
  private workbooks: EducationalWorkbookPlan[] = [];
  private loaded = false;

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("Educational Workbook store path is required.");
  }

  async listActivities(projectId: string): Promise<readonly WorkbookActivity[]> {
    await this.load();
    const project = required(projectId, "Project id");
    return this.activities
      .filter((activity) => activity.projectId === project)
      .sort((a, b) => a.subject.localeCompare(b.subject) || a.id.localeCompare(b.id))
      .map(cloneActivity);
  }

  async upsertActivities(projectId: string, activities: readonly WorkbookActivity[]): Promise<readonly WorkbookActivity[]> {
    await this.load();
    const project = required(projectId, "Project id");
    if (!Array.isArray(activities) || !activities.length) throw new Error("At least one workbook activity is required.");
    const incomingIds = new Set<string>();
    for (const activity of activities) {
      validateWorkbookActivity(activity);
      if (activity.projectId !== project) throw new Error("Workbook activity project does not match target project.");
      if (incomingIds.has(activity.id)) throw new Error(`Duplicate workbook activity id "${activity.id}" in request.`);
      incomingIds.add(activity.id);
    }
    const now = new Date().toISOString();
    for (const activity of activities) {
      const index = this.activities.findIndex((item) => item.projectId === project && item.id === activity.id);
      if (index >= 0) {
        const existing = this.activities[index];
        const next: WorkbookActivity = {
          ...cloneActivity(activity),
          createdAt: existing.createdAt,
          updatedAt: activity.updatedAt === activity.createdAt ? now : activity.updatedAt,
        };
        validateWorkbookActivity(next);
        this.activities[index] = next;
      } else {
        this.activities.push(cloneActivity(activity));
      }
    }
    await this.persist();
    return this.listActivities(project);
  }

  async removeActivity(projectId: string, activityId: string): Promise<boolean> {
    await this.load();
    const project = required(projectId, "Project id");
    const id = required(activityId, "Activity id");
    const index = this.activities.findIndex((item) => item.projectId === project && item.id === id);
    if (index < 0) return false;
    this.activities.splice(index, 1);
    await this.persist();
    return true;
  }

  async listWorkbooks(projectId: string): Promise<readonly EducationalWorkbookPlan[]> {
    await this.load();
    const project = required(projectId, "Project id");
    return this.workbooks
      .filter((workbook) => workbook.projectId === project)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || b.id.localeCompare(a.id))
      .map(cloneWorkbook);
  }

  async getWorkbook(projectId: string, workbookId: string): Promise<EducationalWorkbookPlan | undefined> {
    await this.load();
    const project = required(projectId, "Project id");
    const id = required(workbookId, "Workbook id");
    const workbook = this.workbooks.find((item) => item.projectId === project && item.id === id);
    return workbook ? cloneWorkbook(workbook) : undefined;
  }

  async saveWorkbook(workbook: EducationalWorkbookPlan): Promise<EducationalWorkbookPlan> {
    await this.load();
    validateEducationalWorkbookPlan(workbook);
    if (this.workbooks.some((item) => item.projectId === workbook.projectId && item.id === workbook.id)) throw new Error(`Duplicate Educational Workbook id "${workbook.id}".`);
    this.workbooks.push(cloneWorkbook(workbook));
    await this.persist();
    return cloneWorkbook(workbook);
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedEducationalWorkbookState;
      if (parsed.formatVersion !== EDUCATIONAL_WORKBOOK_STORE_FORMAT_VERSION || !Array.isArray(parsed.activities) || !Array.isArray(parsed.workbooks)) throw new Error("Unsupported or corrupt Educational Workbook store.");
      const activityKeys = new Set<string>();
      this.activities = parsed.activities.map((activity) => {
        validateWorkbookActivity(activity);
        const key = `${activity.projectId}\u0000${activity.id}`;
        if (activityKeys.has(key)) throw new Error(`Duplicate workbook activity id "${activity.id}" in store.`);
        activityKeys.add(key);
        return cloneActivity(activity);
      });
      const workbookKeys = new Set<string>();
      this.workbooks = parsed.workbooks.map((workbook) => {
        validateEducationalWorkbookPlan(workbook);
        const key = `${workbook.projectId}\u0000${workbook.id}`;
        if (workbookKeys.has(key)) throw new Error(`Duplicate Educational Workbook id "${workbook.id}" in store.`);
        workbookKeys.add(key);
        return cloneWorkbook(workbook);
      });
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const state: PersistedEducationalWorkbookState = {
      formatVersion: EDUCATIONAL_WORKBOOK_STORE_FORMAT_VERSION,
      activities: this.activities.map(cloneActivity),
      workbooks: this.workbooks.map(cloneWorkbook),
    };
    const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temp, this.filePath);
  }
}

function cloneActivity(activity: WorkbookActivity): WorkbookActivity {
  return JSON.parse(JSON.stringify(activity)) as WorkbookActivity;
}

function cloneWorkbook(workbook: EducationalWorkbookPlan): EducationalWorkbookPlan {
  return JSON.parse(JSON.stringify(workbook)) as EducationalWorkbookPlan;
}

function required(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}
