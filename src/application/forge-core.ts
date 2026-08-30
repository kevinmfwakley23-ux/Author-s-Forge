import { AiModelBroker, type AiModelResource } from "./ai-model-broker";
import { buildProjectContext, type ProjectContextPipelineOptions, type ProjectContextPipelineResult } from "./context-pipeline";
import { ProjectMemoryStore, type ProjectMemorySnapshot } from "./project-memory-store";

export const FORGE_CORE_FORMAT_VERSION = 1 as const;

export interface ForgeCoreDependencies {
  readonly memoryStore?: ProjectMemoryStore;
  readonly modelBroker?: AiModelBroker;
}

export interface ForgeCoreReadiness {
  readonly formatVersion: typeof FORGE_CORE_FORMAT_VERSION;
  readonly ready: boolean;
  readonly memoryAvailable: boolean;
  readonly aiRoutingAvailable: boolean;
  readonly modelCount: number;
  readonly checks: readonly string[];
}

/**
 * The Forge Brain composition root.
 *
 * Feature offices depend on this shared core instead of creating their own
 * memory, routing, or context systems. Dependencies are injected so the core
 * remains deterministic and testable while real infrastructure can be wired
 * at the application boundary.
 */
export class ForgeCore {
  readonly memory: ProjectMemoryStore;
  readonly ai: AiModelBroker;

  constructor(dependencies: ForgeCoreDependencies = {}) {
    this.memory = dependencies.memoryStore ?? new ProjectMemoryStore();
    this.ai = dependencies.modelBroker ?? new AiModelBroker();
  }

  registerAiModels(resources: readonly AiModelResource[]): void {
    this.ai.setResources(resources);
  }

  applyAiRoutingTelemetry(telemetry: Parameters<AiModelBroker["applyRoutingTelemetry"]>[0]): void {
    this.ai.applyRoutingTelemetry(telemetry);
  }

  buildContext(options: ProjectContextPipelineOptions): ProjectContextPipelineResult {
    return buildProjectContext(this.memory, options);
  }

  snapshotMemory(projectId: string): ProjectMemorySnapshot {
    return this.memory.createSnapshot(projectId);
  }

  restoreMemory(snapshot: ProjectMemorySnapshot): void {
    this.memory.restoreSnapshot(snapshot);
  }

  readiness(): ForgeCoreReadiness {
    const memoryAvailable = this.memory instanceof ProjectMemoryStore;
    const aiRoutingAvailable = this.ai instanceof AiModelBroker;
    const modelCount = this.ai.listResources().length;
    const checks = [
      memoryAvailable ? "memory-store" : "memory-store-missing",
      aiRoutingAvailable ? "ai-routing" : "ai-routing-missing",
      modelCount > 0 ? "configured-models" : "no-configured-models",
      "context-pipeline",
      "portable-memory-snapshot",
    ];

    return {
      formatVersion: FORGE_CORE_FORMAT_VERSION,
      ready: memoryAvailable && aiRoutingAvailable,
      memoryAvailable,
      aiRoutingAvailable,
      modelCount,
      checks,
    };
  }
}

export function createForgeCore(dependencies: ForgeCoreDependencies = {}): ForgeCore {
  return new ForgeCore(dependencies);
}
