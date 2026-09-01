import type { AiModelResource } from "../application/ai-model-broker";

/** Build the canonical broker resource registry from real runtime configuration only. Configuration means eligible to try; health is established by probes or successful routed execution. */
export function discoverConfiguredAiModelResources(env: NodeJS.ProcessEnv = process.env): AiModelResource[] {
  const resources: AiModelResource[] = [];
  const add = (provider: string, model: string | undefined, configured: boolean, capabilities: AiModelResource["capabilities"]): void => {
    if (!configured) return;
    resources.push({ provider, model: model?.trim() || "auto", configured: true, capabilities });
  };
  add("omniroute", env.OMNIROUTE_MODEL, Boolean(env.OMNIROUTE_BASE_URL?.trim()), { contextWindow: 128000, maxOutputTokens: 16000, streaming: true, creativeWriting: true, instructionFollowing: true, longContext: true });
  add("9router", env.ROUTER9_MODEL, Boolean(env.ROUTER9_BASE_URL?.trim()), { contextWindow: 128000, maxOutputTokens: 16000, streaming: true, creativeWriting: true, instructionFollowing: true, longContext: true });
  add("kings", env.KINGS_AI_MODEL, Boolean(env.KINGS_AI_ENDPOINT?.trim()), { contextWindow: 128000, maxOutputTokens: 16000, reasoning: true, vision: true, streaming: true, toolCalls: true, creativeWriting: true, instructionFollowing: true, longContext: true });
  add("openai", env.OPENAI_MODEL, Boolean(env.OPENAI_API_KEY?.trim() && env.OPENAI_MODEL?.trim()), { contextWindow: 128000, maxOutputTokens: 16000, reasoning: true, vision: true, streaming: true, toolCalls: true, creativeWriting: true, instructionFollowing: true, longContext: true });
  add("ollama", env.OLLAMA_MODEL, Boolean(env.OLLAMA_BASE_URL?.trim() && env.OLLAMA_MODEL?.trim()), { contextWindow: 32768, maxOutputTokens: 8192, creativeWriting: true, instructionFollowing: true });
  return resources;
}
