import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  AI_MODEL_PERFORMANCE_FORMAT_VERSION,
  aggregateAiModelPerformance,
  validateAiModelPerformanceObservation,
  type AiModelPerformanceAggregate,
  type AiModelPerformanceObservation,
} from "../domain/ai-model-performance";

interface PerformanceFile {
  readonly formatVersion: typeof AI_MODEL_PERFORMANCE_FORMAT_VERSION;
  readonly observations: readonly AiModelPerformanceObservation[];
}
interface SharedBackend { loaded: boolean; observations: AiModelPerformanceObservation[]; operation: Promise<void>; }
const backends = new Map<string, SharedBackend>();

export class FileAiModelPerformanceStore {
  private readonly path: string;
  private readonly backend: SharedBackend;
  constructor(path: string) {
    this.path = resolve(path);
    this.backend = backends.get(this.path) ?? { loaded: false, observations: [], operation: Promise.resolve() };
    backends.set(this.path, this.backend);
  }

  async append(observation: AiModelPerformanceObservation): Promise<AiModelPerformanceObservation> {
    const validated = validateAiModelPerformanceObservation(observation);
    await this.serial(async () => {
      await this.loadIfNeeded();
      if (this.backend.observations.some((item) => item.id === validated.id)) throw new Error(`AI model performance observation "${validated.id}" already exists.`);
      this.backend.observations.push(clone(validated));
      await this.persist();
    });
    return clone(validated);
  }

  async appendMany(observations: readonly AiModelPerformanceObservation[]): Promise<readonly AiModelPerformanceObservation[]> {
    const validated = observations.map(validateAiModelPerformanceObservation);
    const ids = new Set<string>();
    for (const item of validated) { if (ids.has(item.id)) throw new Error(`Duplicate AI model performance observation "${item.id}" in batch.`); ids.add(item.id); }
    await this.serial(async () => {
      await this.loadIfNeeded();
      for (const item of validated) if (this.backend.observations.some((existing) => existing.id === item.id)) throw new Error(`AI model performance observation "${item.id}" already exists.`);
      this.backend.observations.push(...validated.map(clone));
      await this.persist();
    });
    return validated.map(clone);
  }

  async list(projectId?: string): Promise<readonly AiModelPerformanceObservation[]> {
    await this.serial(() => this.loadIfNeeded());
    return this.backend.observations
      .filter((item) => projectId === undefined || item.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map(clone);
  }

  async aggregate(projectId: string, minimumSamples = 3): Promise<readonly AiModelPerformanceAggregate[]> {
    return aggregateAiModelPerformance(await this.list(projectId), minimumSamples);
  }

  private async serial<T>(work: () => Promise<T>): Promise<T> {
    const previous = this.backend.operation;
    let release!: () => void;
    this.backend.operation = new Promise<void>((resolvePromise) => { release = resolvePromise; });
    await previous;
    try { return await work(); }
    finally { release(); }
  }
  private async loadIfNeeded(): Promise<void> {
    if (this.backend.loaded) return;
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as PerformanceFile;
      if (parsed.formatVersion !== AI_MODEL_PERFORMANCE_FORMAT_VERSION || !Array.isArray(parsed.observations)) throw new Error("Unsupported or corrupt AI model performance ledger.");
      this.backend.observations = parsed.observations.map(validateAiModelPerformanceObservation).map(clone);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.backend.observations = [];
    }
    this.backend.loaded = true;
  }
  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temp = `${this.path}.${process.pid}.${Date.now()}.tmp`;
    const payload: PerformanceFile = { formatVersion: AI_MODEL_PERFORMANCE_FORMAT_VERSION, observations: this.backend.observations };
    await writeFile(temp, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temp, this.path);
  }
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
