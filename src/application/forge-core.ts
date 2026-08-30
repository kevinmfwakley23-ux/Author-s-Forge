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
  /** Durable project adapter supplied by infrastructure at the application composition root. */
  readonly projectStore?: ProjectStorePort;
}

export interface ForgeCoreSnapshot {
  readonly formatVersion: typeof FORGE_CORE_FORMAT_VERSION;
  readonly memory: ProjectMemorySnapshot;
  readonly routing: AiRoutingStateSnapshot;
}

export interface ForgeCoreReadiness {
  readonly formatVersion: typeof FORGE_CORE_FORMAT_VERSION;
  readonly ready: boolean;
  readonly memoryAvailable: boolean;
  readonly aiRoutingAvailable: boolean;
  readonly aiConfigured: boolean;
  readonly projectStoreAvailable: boolean;
  readonly modelCount: number;
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

  registerAiModels(resources: readonly AiModelResource[]): void {
    this.ai.setResources(resources);
    this.routing.hydrate(resources);
  }

  applyAiRoutingTelemetry(telemetry: Parameters<AiModelBroker["applyRoutingTelemetry"]>[0]): void {
    this.ai.applyRoutingTelemetry(telemetry);
    this.routing.hydrate(this.ai.listResources());
  }

  async createProject(project: ProjectState): Promise<void> {
    return this.requireProjectStore().create(project);
  }

  async loadProject(projectId: string): Promise<ProjectState | null> {
    return this.requireProjectStore().load(projectId);
  }

  async saveProject(project: ProjectState): Promise<void> {
    return this.requireProjectStore().save(project);
  }

  async projectExists(projectId: string): Promise<boolean> {
    return this.requireProjectStore().exists(projectId);
  }

  buildContext(options: ProjectContextPipelineOptions): ProjectContextPipelineResult { return buildProjectContext(this.memory, options); }
  snapshotMemory(projectId: string): ProjectMemorySnapshot { return this.memory.createSnapshot(projectId); }
  restoreMemory(snapshot: ProjectMemorySnapshot): void { this.memory.restoreSnapshot(snapshot); }

  snapshot(projectId: string): ForgeCoreSnapshot {
    return { formatVersion: FORGE_CORE_FORMAT_VERSION, memory: this.memory.createSnapshot(projectId), routing: this.routing.createSnapshot() };
  }

  restore(snapshot: ForgeCoreSnapshot): void {
    if (snapshot.formatVersion !== FORGE_CORE_FORMAT_VERSION) throw new Error("Unsupported Forge Core snapshot format.");
    this.memory.restoreSnapshot(snapshot.memory);
    this.routing.restore(snapshot.routing);
    this.ai.applyRoutingTelemetry(this.routing.snapshot().map(state => ({
      provider: state.provider, model: state.model, consecutiveFailures: state.consecutiveFailures,
      totalTokens: state.totalTokens, lastLatencyMs: state.lastLatencyMs, cooldownUntil: state.cooldownUntil
    })));
  }

  readiness(): ForgeCoreReadiness {
    const memoryAvailable = this.memory instanceof ProjectMemoryStore;
    const aiRoutingAvailable = this.ai instanceof AiModelBroker;
    const projectStoreAvailable = this.projectStore !== undefined;
    const modelCount = this.ai.listResources().length;
    const aiConfigured = modelCount > 0;
    const checks = [
      memoryAvailable ? "memory-store" : "memory-store-missing",
      aiRoutingAvailable ? "ai-routing" : "ai-routing-missing",
      aiConfigured ? "configured-models" : "no-configured-models",
      projectStoreAvailable ? "durable-project-store" : "durable-project-store-unbound",
      "context-pipeline", "portable-memory-snapshot", "durable-routing-state"
    ];
    return { formatVersion: FORGE_CORE_FORMAT_VERSION, ready: memoryAvailable && aiRoutingAvailable && aiConfigured, memoryAvailable, aiRoutingAvailable, aiConfigured, projectStoreAvailable, modelCount, checks };
  }

  private requireProjectStore(): ProjectStorePort {
    if (!this.projectStore) throw new Error("Forge Core durable project store is not configured.");
    return this.projectStore;
  }
}

export function createForgeCore(dependencies: ForgeCoreDependencies = {}): ForgeCore { return new ForgeCore(dependencies); }
