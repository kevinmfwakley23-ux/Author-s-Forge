import type { ForgeCapability, ForgeCapabilityAvailability, ForgeRuntimeContext, ForgeRuntimeKind, ForgeRuntimeIdentity, ForgeDeviceIdentity, PortableProjectReference, RuntimeCheckpointState } from "../domain/runtime";

export interface RuntimeAdapter {
  readonly kind: ForgeRuntimeKind;
  identify(): ForgeRuntimeContext;
  capabilities(): readonly ForgeCapabilityAvailability[];
}

export function createRuntimeContext(input: {
  runtime: ForgeRuntimeIdentity;
  device: ForgeDeviceIdentity;
  capabilities: readonly ForgeCapabilityAvailability[];
}): ForgeRuntimeContext {
  return {
    runtime: { ...input.runtime },
    device: { ...input.device },
    capabilities: [...input.capabilities]
  };
}

export function createPortableReference(projectId: string, formatVersion: number): PortableProjectReference {
  return {
    projectId,
    formatVersion,
    canonicalLocation: "portable-project"
  };
}

export function markRuntimeInterrupted(projectId: string, runtimeId?: string, savedAt?: string): RuntimeCheckpointState {
  if (!projectId.trim()) throw new Error("Project id is required.");
  return {
    projectId,
    status: "interrupted",
    savedAt: savedAt ?? new Date().toISOString(),
    ...(runtimeId ? { runtimeId } : {})
  };
}

export function requireCapabilities(context: ForgeRuntimeContext, required: readonly ForgeCapability[]): void {
  const unavailable = required.filter((capability) => !context.capabilities.some((entry) => entry.capability === capability && entry.available));
  if (unavailable.length > 0) {
    throw new Error(`Required Forge capabilities unavailable: ${unavailable.join(", ")}`);
  }
}
