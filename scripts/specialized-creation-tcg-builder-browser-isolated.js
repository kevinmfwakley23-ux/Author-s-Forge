#!/usr/bin/env node

// This browser acceptance deliberately proves Forge's honest no-provider path.
// CI/developer machines may have any of Forge's supported providers configured;
// none of those credentials or model/resource overrides may leak into this
// hermetic test and turn a deterministic rejection into a real network call.
const providerEnvironmentKeys = [
  "AI_MODEL_RESOURCES_JSON",
  "AI_PINNED_PROVIDER",
  "AI_PINNED_MODEL",
  "AI_PROVIDER_ORDER",
  "AI_ROUTING_MODE",
  "AI_SPEND_POLICY",
  "AI_TRUSTED_NO_SPEND_MODELS",
  "OMNIROUTE_BASE_URL",
  "OMNIROUTE_API_KEY",
  "OMNIROUTE_MODEL",
  "OMNIROUTE_MODELS",
  "ROUTER9_BASE_URL",
  "ROUTER9_API_KEY",
  "ROUTER9_MODEL",
  "ROUTER9_MODELS",
  "KINGS_AI_ENDPOINT",
  "KINGS_AI_RESPONSES_URL",
  "KINGS_AI_API_KEY",
  "KINGS_AI_MODEL",
  "KINGS_AI_MODELS",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_MODELS",
  "OLLAMA_BASE_URL",
  "OLLAMA_MODEL",
  "OLLAMA_MODELS",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "GROQ_MODELS",
  "MISTRAL_API_KEY",
  "MISTRAL_MODEL",
  "MISTRAL_MODELS",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_MODELS",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_MODELS",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_MODELS",
];

for (const key of providerEnvironmentKeys) delete process.env[key];

// The test must fail fast if a future provider source unexpectedly escapes the
// isolation boundary. One second is the provider transport's supported floor.
process.env.AI_PROVIDER_TIMEOUT_MS = "1000";

await import("./specialized-creation-tcg-builder-browser-acceptance.js");
