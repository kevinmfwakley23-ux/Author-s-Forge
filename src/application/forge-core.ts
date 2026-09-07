import { AiModelBroker, type AiModelResource } from "./ai-model-broker";
import { AiRoutingState, type AiRoutingStateSnapshot } from "./ai-routing-state";
import { buildProjectContext, type ProjectContextPipelineOptions, type ProjectContextPipelineResult } from "./context-pipeline";
import { ProjectMemoryStore, type ProjectMemorySnapshot } from "./project-memory-store";
import type { ProjectState } from "../domain/project";
import type { ProjectStorePort } from "./project-store-port";

export const FORGE_CORE_FORMAT_VERSION = 2 as const;

export interface ForgeCoreDependencies {
  readonly memoryStore?: ProjectMemoryStore;
  readonly modelBroker?: AiModelBroker;
  readonly routingState?: AiRoutingState;
  readonly projectStore?: ProjectStorePort;
}

export interface ForgeCoreSnapshot {
  readonly formatVersion: typeof FORGE_CORE_FORMAT_VERSION;
  readonly projectId: string;
  readonly project?: ProjectState;
  readonly memory: ProjectMemorySnapshot;
  readonly routing: AiRoutingStateSnapshot;
}

export interface ForgeCoreReadiness {
  readonly formatVersion: typeof FORGE_CORE_FORMAT_VERSION;
  readonly ready: boolean;
  readonly memoryAvailable: boolean;
  readonly aiRoutingAvailable: boolean;
  /** At least one model/provider is configured. This does not mean it can serve a request now. */
  readonly aiConfigured: boolean;
  /** At least one configured resource is not explicitly unhealthy or in cooldown. */
  readonly aiOperational: boolean;
  readonly projectStoreAvailable: boolean;
  /** Backward-compatible configured model count. */
  readonly modelCount: number;
  readonly operationalModelCount: number;
  readonly checks: readonly string[];
}

/** The single shared composition root for every Author's Forge office. */
export class ForgeCore {
  readonly memory: ProjectMemoryStore;
  readonly ai: AiModelBroker;
  readonly routing: AiRoutingState;
  readonly projectStore?: ProjectStorePort;

  constructor(dependencies: ForgeCoreDependencies = {}) {
    this.memory = dependencies.memoryStore ?? new ProjectMemoryStore();
    this.ai = dependencies.modelBroker ?? new AiModelBroker();
    this.routing = dependencies.routingState ?? new AiRoutingState();
    this.projectStore = dependencies.projectStore;
    this.routing.hydrate(this.ai.listResources());
  }

  registerAiModels(resources: readonly AiModelResource[]): void { this.ai.setResources(resources); this.routing.hydrate(resources); }
  applyAiRoutingTelemetry(telemetry: Parameters<AiModelBroker["applyRoutingTelemetry"]>[0]): void { this.ai.applyRoutingTelemetry(telemetry); this.routing.hydrate(this.ai.listResources()); }
  async createProject(project: ProjectState): Promise<void> { return this.requireProjectStore().create(project); }
  async loadProject(projectId: string): Promise<ProjectState | null> { return this.requireProjectStore().load(projectId); }
  async saveProject(project: ProjectState): Promise<void> { return this.requireProjectStore().save(project); }
  async projectExists(projectId: string): Promise<boolean> { return this.requireProjectStore().exists(projectId); }
  buildContext(options: ProjectContextPipelineOptions): ProjectContextPipelineResult { return buildProjectContext(this.memory, options); }
  snapshotMemory(projectId: string): ProjectMemorySnapshot { return this.memory.createSnapshot(projectId); }
  restoreMemory(snapshot: ProjectMemorySnapshot): void { this.memory.restoreSnapshot(snapshot); }

  snapshot(projectId: string): ForgeCoreSnapshot { return { formatVersion: FORGE_CORE_FORMAT_VERSION, projectId, memory: this.memory.createSnapshot(projectId), routing: this.routing.createSnapshot() }; }

  async snapshotDurable(projectId: string): Promise<ForgeCoreSnapshot> {
    const project = await this.requireProjectStore().load(projectId);
    if (!project) throw new Error(`Cannot snapshot missing project: ${projectId}`);
    return { ...this.snapshot(projectId), project };
  }

  async restoreDurable(snapshot: ForgeCoreSnapshot): Promise<void> {
    this.validateSnapshot(snapshot);
    const project = snapshot.project;
    if (!project) throw new Error("Forge Core durable snapshot does not contain project state.");
    if (project.metadata.id !== snapshot.projectId) throw new Error("Forge Core snapshot project identity mismatch.");
    await this.requireProjectStore().save(project);
    this.restore(snapshot);
  }

  restore(snapshot: ForgeCoreSnapshot): void {
    this.validateSnapshot(snapshot);
    this.memory.restoreSnapshot(snapshot.memory);
    this.routing.restore(snapshot.routing);
    this.ai.applyRoutingTelemetry(this.routing.snapshot().map(state => ({ provider: state.provider, model: state.model, consecutiveFailures: state.consecutiveFailures, totalTokens: state.totalTokens, lastLatencyMs: state.lastLatencyMs, cooldownUntil: state.cooldownUntil })));
  }

  readiness(now = new Date().toISOString()): ForgeCoreReadiness {
    const memoryAvailable = this.memory instanceof ProjectMemoryStore;
    const aiRoutingAvailable = this.ai instanceof AiModelBroker;
    const projectStoreAvailable = this.projectStore !== undefined;
    const resources = this.ai.listResources();
    const modelCount = resources.length;
    const aiConfigured = modelCount > 0;
    const operationalModelCount = resources.filter((resource) => isOperationalResource(resource, now)).length;
    const aiOperational = operationalModelCount > 0;
    const checks = [
      memoryAvailable ? "memory-store" : "memory-store-missing",
      aiRoutingAvailable ? "ai-routing" : "ai-routing-missing",
      aiConfigured ? "configured-models" : "no-configured-models",
      aiOperational ? "operational-models" : "no-operational-models",
      projectStoreAvailable ? "durable-project-store" : "durable-project-store-unbound",
      "context-pipeline",
      "portable-memory-snapshot",
      "durable-routing-state",
      "durable-project-snapshot",
    ];
    return {
      formatVersion: FORGE_CORE_FORMAT_VERSION,
      ready: memoryAvailable && aiRoutingAvailable && aiOperational && projectStoreAvailable,
      memoryAvailable,
      aiRoutingAvailable,
      aiConfigured,
      aiOperational,
      projectStoreAvailable,
      modelCount,
      operationalModelCount,
      checks,
    };
  }

  private validateSnapshot(snapshot: ForgeCoreSnapshot): void {
    if (!snapshot || snapshot.formatVersion !== FORGE_CORE_FORMAT_VERSION) throw new Error("Unsupported Forge Core snapshot format.");
    if (!snapshot.projectId || snapshot.memory.projectId !== snapshot.projectId) throw new Error("Forge Core snapshot project identity mismatch.");
  }

  private requireProjectStore(): ProjectStorePort { if (!this.projectStore) throw new Error("Forge Core durable project store is not configured."); return this.projectStore; }
}

function isOperationalResource(resource: AiModelResource, now: string): boolean {
  if (resource.healthy === false) return false;
  if (!resource.cooldownUntil) return true;
  const cooldown = Date.parse(resource.cooldownUntil);
  const current = Date.parse(now);
  if (!Number.isFinite(cooldown) || !Number.isFinite(current)) return true;
  return cooldown <= current;
}

export function createForgeCore(dependencies: ForgeCoreDependencies = {}): ForgeCore { return new ForgeCore(dependencies); }
