export { createProductionContextEngineRegistry, CONTEXT_ENGINE_CAPABILITIES } from "./context-engine-stack";
export type { ContextEngineCapability } from "./context-engine-stack";

import { createProductionContextEngineRegistry } from "./context-engine-stack";

/** Backward-compatible factory used by the context optimizer. */
export function createDefaultContextEngineRegistry() {
  return createProductionContextEngineRegistry();
}
