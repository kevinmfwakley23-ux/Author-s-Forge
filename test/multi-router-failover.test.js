import test from "node:test";
import assert from "node:assert/strict";
import { generateText } from "../dist/infrastructure/ai-provider.js";

function saveEnv(names) {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}
function restoreEnv(previous) {
  for (const [name, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

test("AI generation fails over from OmniRoute to 9Router without fabricating output", async () => {
  const names = ["AI_PROVIDER_ORDER", "OMNIROUTE_BASE_URL", "OMNIROUTE_MODEL", "OMNIROUTE_API_KEY", "ROUTER9_BASE_URL", "ROUTER9_MODEL", "ROUTER9_API_KEY", "KINGS_AI_ENDPOINT", "OPENAI_API_KEY", "OLLAMA_BASE_URL"];
  const previous = saveEnv(names);
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    process.env.AI_PROVIDER_ORDER = "omniroute,9router";
    process.env.OMNIROUTE_BASE_URL = "http://omni.test";
    process.env.OMNIROUTE_MODEL = "auto";
    process.env.ROUTER9_BASE_URL = "http://router9.test";
    process.env.ROUTER9_MODEL = "auto";
    delete process.env.OMNIROUTE_API_KEY;
    delete process.env.ROUTER9_API_KEY;
    delete process.env.KINGS_AI_ENDPOINT;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).startsWith("http://omni.test")) return new Response(JSON.stringify({ error: { message: "429 quota exhausted" } }), { status: 429 });
      return new Response(JSON.stringify({ id: "router9-ok", choices: [{ message: { content: "real fallback response" } }] }), { status: 200 });
    };

    const result = await generateText({ system: "author system", user: "write the next paragraph", temperature: 0 });
    assert.equal(result.provider, "9router");
    assert.equal(result.model, "auto");
    assert.equal(result.text, "real fallback response");
    assert.deepEqual(result.attempts?.map((attempt) => [attempt.provider, attempt.success]), [["omniroute", false], ["9router", true]]);
    assert.deepEqual(calls, ["http://omni.test/v1/chat/completions", "http://router9.test/v1/chat/completions"]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(previous);
  }
});

test("AI generation reports an actionable failure when every configured real resource is unavailable", async () => {
  const names = ["AI_PROVIDER_ORDER", "OMNIROUTE_BASE_URL", "OMNIROUTE_MODEL", "ROUTER9_BASE_URL", "ROUTER9_MODEL", "KINGS_AI_ENDPOINT", "OPENAI_API_KEY", "OLLAMA_BASE_URL"];
  const previous = saveEnv(names);
  try {
    process.env.AI_PROVIDER_ORDER = "omniroute,9router,kings,openai,ollama";
    for (const name of names.slice(1)) delete process.env[name];
    await assert.rejects(() => generateText({ system: "system", user: "write", temperature: 0 }), /No AI provider is configured/);
  } finally {
    restoreEnv(previous);
  }
});
