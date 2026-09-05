#!/usr/bin/env node
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const target = String(process.argv[2] || "").trim().toLowerCase();
const supported = new Set(["omniroute", "9router", "ollama", "kings"]);
if (!supported.has(target)) {
  fail("Usage: node scripts/ai-live-smoke.js <omniroute|9router|ollama|kings>");
}
if (process.env.AI_LIVE_SMOKE !== "1") {
  fail("Live AI certification is opt-in. Set AI_LIVE_SMOKE=1 only when you intend to send a real provider request.");
}

const prefixByProvider = {
  omniroute: "OMNIROUTE_",
  "9router": "ROUTER9_",
  ollama: "OLLAMA_",
  kings: "KINGS_AI_",
};
const allProviderPrefixes = [
  "OMNIROUTE_", "ROUTER9_", "KINGS_AI_", "OPENAI_", "OLLAMA_",
  "GROQ_", "MISTRAL_", "GEMINI_", "ANTHROPIC_", "OPENROUTER_",
];
const targetPrefix = prefixByProvider[target];

// Isolate the smoke from every non-target provider. A certification request
// must never pass because Forge silently fell back to a different account.
for (const key of Object.keys(process.env)) {
  if (allProviderPrefixes.some((prefix) => key.startsWith(prefix)) && !key.startsWith(targetPrefix)) {
    delete process.env[key];
  }
}
delete process.env.AI_MODEL_RESOURCES_JSON;
delete process.env.AI_PINNED_PROVIDER;
delete process.env.AI_PINNED_MODEL;

assertTargetConfiguration(target);

const spendPolicy = parseEnum(
  process.env.AI_LIVE_SPEND_POLICY,
  ["no-paid-tokens", "budgeted", "unrestricted"],
  "no-paid-tokens",
  "AI_LIVE_SPEND_POLICY",
);
const routingMode = parseEnum(
  process.env.AI_LIVE_ROUTING_MODE,
  ["economy", "balanced", "quality"],
  "economy",
  "AI_LIVE_ROUTING_MODE",
);
const maxEstimatedRequestCostUsd = spendPolicy === "budgeted"
  ? requiredNonnegative(process.env.AI_LIVE_MAX_REQUEST_COST_USD, "AI_LIVE_MAX_REQUEST_COST_USD")
  : undefined;

const isolatedDataRoot = mkdtempSync(join(tmpdir(), "authors-forge-ai-live-"));
mkdirSync(isolatedDataRoot, { recursive: true });
writeFileSync(join(isolatedDataRoot, "ai-runtime-control.json"), JSON.stringify({
  formatVersion: 1,
  spendPolicy,
  routingMode,
  providerOrder: [target],
  ...(maxEstimatedRequestCostUsd === undefined ? {} : { maxEstimatedRequestCostUsd }),
  updatedAt: new Date().toISOString(),
}, null, 2));
process.env.FORGE_DATA_DIR = isolatedDataRoot;
process.env.AI_CACHE_ENABLED = "false";

(async () => {
  try {
    const { generateText, aiConfiguredResources, aiConfiguredProviderQuotas } = require("../dist/infrastructure/ai-provider.js");
    const resources = aiConfiguredResources().filter((resource) => resource.provider === target);
    if (!resources.length) {
      fail(configurationHelp(target));
    }

    const result = await generateText({
      system: "This is an Author's Forge live provider compatibility smoke test. Follow the request exactly and do not claim any external facts.",
      user: "Return one complete sentence confirming that this live provider request produced a response.",
      task: "research",
      maxOutputTokens: 64,
      preferProvider: target,
    });

    if (result.provider !== target) {
      throw new Error(`Certification failed: requested ${target} but Forge returned ${result.provider}.`);
    }
    if (!result.text || !result.text.trim()) {
      throw new Error(`Certification failed: ${target} returned empty generated content.`);
    }
    if (!resources.some((resource) => resource.model === result.model)) {
      throw new Error(`Certification failed: returned model ${result.model} was not in the target provider's configured resource set.`);
    }

    const quota = aiConfiguredProviderQuotas().find((item) => item.scope === target);
    process.stdout.write(`${JSON.stringify({
      certified: true,
      provider: result.provider,
      model: result.model,
      requestId: result.requestId ?? null,
      outputCharacters: result.text.length,
      usage: result.usage ?? null,
      accountedTokens: result.routing?.accountedTokens ?? null,
      usageSource: result.routing?.usageSource ?? null,
      providerQuota: quota ?? null,
      timeoutMs: process.env.AI_PROVIDER_TIMEOUT_MS || "120000-default",
      spendPolicy,
      routingMode,
    }, null, 2)}\n`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[Forge live AI certification] ${target} FAILED: ${detail}\n`);
    if (/spend policy|no healthy configured ai model/i.test(detail)) {
      process.stderr.write("Forge did not bypass spend protection. Classify the target model/provider accurately or explicitly choose AI_LIVE_SPEND_POLICY=unrestricted only if you intend to permit that real request.\n");
    }
    process.exitCode = 1;
  } finally {
    rmSync(isolatedDataRoot, { recursive: true, force: true });
  }
})();

function assertTargetConfiguration(provider) {
  if (provider === "omniroute" && !process.env.OMNIROUTE_BASE_URL?.trim()) fail("OMNIROUTE_BASE_URL is required for live OmniRoute certification.");
  if (provider === "9router") {
    if (!process.env.ROUTER9_BASE_URL?.trim()) fail("ROUTER9_BASE_URL is required for live 9Router certification.");
    if (!process.env.ROUTER9_MODEL?.trim() && !process.env.ROUTER9_MODELS?.trim()) fail("ROUTER9_MODEL or ROUTER9_MODELS is required; Forge will not invent a universal 9Router auto model.");
  }
  if (provider === "ollama") {
    if (!process.env.OLLAMA_BASE_URL?.trim()) fail("OLLAMA_BASE_URL is required for live Ollama certification.");
    if (!process.env.OLLAMA_MODEL?.trim() && !process.env.OLLAMA_MODELS?.trim()) fail("OLLAMA_MODEL or OLLAMA_MODELS is required for live Ollama certification.");
  }
  if (provider === "kings") {
    const endpoint = process.env.KINGS_AI_RESPONSES_URL?.trim();
    if (!endpoint) fail("KINGS_AI_RESPONSES_URL is required. The normal K.I.N.G.S. owner/coding-machine root is not a generic text endpoint.");
    if (!/\/(?:v1\/)?responses\/?$/i.test(endpoint)) fail("KINGS_AI_RESPONSES_URL must point to an explicit Responses-compatible /responses endpoint.");
    if (!process.env.KINGS_AI_MODEL?.trim() && !process.env.KINGS_AI_MODELS?.trim()) fail("KINGS_AI_MODEL or KINGS_AI_MODELS is required for live K.I.N.G.S. certification.");
  }
}

function configurationHelp(provider) {
  return `No usable ${provider} model resource was discovered. Check its endpoint/model configuration and billing classification. This smoke test does not fabricate models or bypass Forge spend policy.`;
}

function parseEnum(value, allowed, fallback, label) {
  if (!value?.trim()) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!allowed.includes(normalized)) fail(`${label} must be one of: ${allowed.join(", ")}.`);
  return normalized;
}

function requiredNonnegative(value, label) {
  const parsed = Number(value);
  if (!value?.trim() || !Number.isFinite(parsed) || parsed < 0) fail(`${label} must be a non-negative number when budgeted live certification is selected.`);
  return parsed;
}

function fail(message) {
  process.stderr.write(`[Forge live AI certification] ${message}\n`);
  process.exit(2);
}
