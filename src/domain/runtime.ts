export type ForgeRuntimeKind =
  | "web-desktop"
  | "web-tablet"
  | "web-mobile"
  | "desktop-app"
  | "mobile-app"
  | "local-development"
  | "remote-cloud";

export type ForgeConnectivity = "online" | "offline" | "degraded" | "unknown";

export type ForgeCapability =
  | "storage"
  | "input"
  | "audio-capture"
  | "file-import"
  | "file-export"
  | "network"
  | "notifications"
  | "clipboard"
  | "display";

export interface ForgeRuntimeIdentity {
  readonly id: string;
  readonly kind: ForgeRuntimeKind;
  readonly version?: string;
  readonly connectivity: ForgeConnectivity;
}

export interface ForgeDeviceIdentity {
  readonly id: string;
  readonly class: "desktop" | "tablet" | "phone" | "server" | "unknown";
  readonly platform?: string;
  readonly platformVersion?: string;
}

export interface ForgeCapabilityAvailability {
  readonly capability: ForgeCapability;
  readonly available: boolean;
  readonly reason?: string;
}

export interface ForgeRuntimeContext {
  readonly runtime: ForgeRuntimeIdentity;
  readonly device: ForgeDeviceIdentity;
  readonly capabilities: readonly ForgeCapabilityAvailability[];
}

export interface PortableProjectReference {
  readonly projectId: string;
  readonly formatVersion: number;
  readonly canonicalLocation: "portable-project";
}

export interface RuntimeCheckpointState {
  readonly projectId: string;
  readonly status: "active" | "interrupted" | "recoverable";
  readonly savedAt: string;
  readonly runtimeId?: string;
}

export function hasCapability(context: ForgeRuntimeContext, capability: ForgeCapability): boolean {
  return context.capabilities.some((entry) => entry.capability === capability && entry.available);
}

export function createPortableProjectReference(projectId: string, formatVersion: number): PortableProjectReference {
  if (!projectId.trim()) throw new Error("Project id is required.");
  if (!Number.isInteger(formatVersion) || formatVersion < 1) {
    throw new Error("Project format version must be a positive integer.");
  }
  return { projectId, formatVersion, canonicalLocation: "portable-project" };
}

export function createRuntimeCheckpoint(input: {
  projectId: string;
  status: RuntimeCheckpointState["status"];
  savedAt?: string;
  runtimeId?: string;
}): RuntimeCheckpointState {
  if (!input.projectId.trim()) throw new Error("Project id is required.");
  return {
    projectId: input.projectId,
    status: input.status,
    savedAt: input.savedAt ?? new Date().toISOString(),
    ...(input.runtimeId ? { runtimeId: input.runtimeId } : {})
  };
}
