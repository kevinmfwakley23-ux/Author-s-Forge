import type { ForgeCore } from "../application/forge-core";
import { createDefaultForgeStudioRuntime, createForgeStudioRuntime } from "./forge-studio-runtime";

/** Production composition root for the shared Forge Brain. */
export function createForgeCoreRuntime(dataRoot: string): ForgeCore {
  return createForgeStudioRuntime(dataRoot).core;
}

/** Standard runtime location used by Studio and device launchers. */
export function createDefaultForgeCoreRuntime(cwd = process.cwd()): ForgeCore {
  return createDefaultForgeStudioRuntime(cwd).core;
}
