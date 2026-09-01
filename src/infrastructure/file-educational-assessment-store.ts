import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateEducationalAssessmentRecord, validateEducationalRubric, type EducationalAssessmentRecord, type EducationalRubric } from "../domain/educational-assessment";

export const EDUCATIONAL_ASSESSMENT_STORE_FORMAT_VERSION = 1 as const;

interface State {
  readonly formatVersion: 1;
  readonly rubrics: readonly EducationalRubric[];
  readonly assessments: readonly EducationalAssessmentRecord[];
}

export class FileEducationalAssessmentStore {
  private rubrics: EducationalRubric[] = [];
  private assessments: EducationalAssessmentRecord[] = [];
  private loaded = false;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {
    if (!filePath.trim()) throw new Error("Educational assessment store path is required.");
  }

  async listRubrics(projectId: string) {
    await this.load();
    const project = required(projectId, "Project id");
    return this.rubrics
      .filter((item) => item.projectId === project)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))
      .map(clone);
  }

  async getRubric(projectId: string, rubricId: string) {
    await this.load();
    const project = required(projectId, "Project id");
    const id = required(rubricId, "Rubric id");
    const rubric = this.rubrics.find((item) => item.projectId === project && item.id === id);
    return rubric ? clone(rubric) : undefined;
  }

  async saveRubric(rubric: EducationalRubric) {
    return this.exclusive(async () => {
      await this.load();
      const validated = validateEducationalRubric(rubric);
      if (this.rubrics.some((item) => item.projectId === validated.projectId && item.id === validated.id)) {
        throw new Error(`Duplicate educational rubric id "${validated.id}".`);
      }
      const nextRubrics = [...this.rubrics, clone(validated)];
      await this.persist(nextRubrics, this.assessments);
      this.rubrics = nextRubrics;
      return clone(validated);
    });
  }

  async listAssessments(projectId: string, rubricId?: string) {
    await this.load();
    const project = required(projectId, "Project id");
    return this.assessments
      .filter((item) => item.projectId === project && (!rubricId || item.rubricId === rubricId))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id))
      .map(clone);
  }

  async saveAssessment(record: EducationalAssessmentRecord) {
    return this.exclusive(async () => {
      await this.load();
      const rubric = this.rubrics.find((item) => item.projectId === record.projectId && item.id === record.rubricId);
      if (!rubric) throw new Error(`Assessment references missing rubric "${record.rubricId}".`);
      const validated = validateEducationalAssessmentRecord(record, rubric);
      if (this.assessments.some((item) => item.projectId === validated.projectId && item.id === validated.id)) {
        throw new Error(`Duplicate educational assessment id "${validated.id}".`);
      }
      const nextAssessments = [...this.assessments, clone(validated)];
      await this.persist(this.rubrics, nextAssessments);
      this.assessments = nextAssessments;
      return clone(validated);
    });
  }

  private async load() {
    if (this.loaded) return;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as State;
      if (parsed.formatVersion !== 1 || !Array.isArray(parsed.rubrics) || !Array.isArray(parsed.assessments)) {
        throw new Error("Unsupported or corrupt educational assessment store.");
      }
      const rubricKeys = new Set<string>();
      this.rubrics = parsed.rubrics.map((value) => {
        const rubric = validateEducationalRubric(value);
        const key = `${rubric.projectId}\0${rubric.id}`;
        if (rubricKeys.has(key)) throw new Error(`Duplicate educational rubric id "${rubric.id}" in store.`);
        rubricKeys.add(key);
        return clone(rubric);
      });
      const assessmentKeys = new Set<string>();
      this.assessments = parsed.assessments.map((value) => {
        const rubric = this.rubrics.find((item) => item.projectId === value.projectId && item.id === value.rubricId);
        if (!rubric) throw new Error(`Stored assessment references missing rubric "${value.rubricId}".`);
        const record = validateEducationalAssessmentRecord(value, rubric);
        const key = `${record.projectId}\0${record.id}`;
        if (assessmentKeys.has(key)) throw new Error(`Duplicate educational assessment id "${record.id}" in store.`);
        assessmentKeys.add(key);
        return clone(record);
      });
    } catch (error) {
      if (!missing(error)) throw error;
    }
    this.loaded = true;
  }

  private async persist(rubrics: readonly EducationalRubric[], assessments: readonly EducationalAssessmentRecord[]) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const state: State = {
      formatVersion: 1,
      rubrics: rubrics.map(clone),
      assessments: assessments.map(clone),
    };
    const temp = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temp, this.filePath);
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.mutationQueue.then(operation, operation);
    this.mutationQueue = run.then(() => undefined, () => undefined);
    return run;
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function required(value: string, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function missing(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ENOENT");
}
