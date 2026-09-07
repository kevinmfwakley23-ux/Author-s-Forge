import { inspectForgeCore } from "../application/forge-core-health";
import type { AiWritingGenerator } from "../application/ai-writing-coordinator";
import { bindForgeAiRuntime, generateText } from "./ai-provider";
import { createDefaultForgeStudioRuntime } from "./forge-studio-runtime";

/**
 * Process-wide production runtime for the main Author's Forge Studio.
 *
 * The main Studio is the only production office in this process. Initializing
 * this module binds every legacy direct generateText call to the same ForgeCore
 * broker/routing objects, while generateMainStudioText reasserts that binding
 * before each writing/editing request so another test/runtime cannot silently
 * replace the authoritative AI boundary.
 */
const runtime = createDefaultForgeStudioRuntime();

export function getMainStudioForgeRuntime() {
  return runtime;
}

export const generateMainStudioText: AiWritingGenerator = async (request) => {
  bindForgeAiRuntime(runtime.core.ai, runtime.core.routing);
  return generateText(request);
};

export function inspectMainStudioForgeRuntime() {
  bindForgeAiRuntime(runtime.core.ai, runtime.core.routing);
  return inspectForgeCore(runtime.core);
}
