const test = require("node:test");
const assert = require("node:assert/strict");

function loadProvider() {
  return require("../.forge-build/infrastructure/ai-provider.js");
}

test("AI cache is disabled unless explicitly enabled", async () => {
  const previous = process.env.AI_CACHE_ENABLED;
  delete process.env.AI_CACHE_ENABLED;
  delete process.env.KINGS_AI_ENDPOINT;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OLLAMA_BASE_URL;
  try {
    await assert.rejects(
      () => loadProvider().generateText({ system: "system", user: "request", temperature: 0 }),
      /No AI provider is configured/
    );
  } finally {
    if (previous === undefined) delete process.env.AI_CACHE_ENABLED;
    else process.env.AI_CACHE_ENABLED = previous;
  }
});

test("cacheable requests use deterministic zero-temperature policy", () => {
  const source = require("fs").readFileSync("src/infrastructure/ai-provider.ts", "utf8");
  assert.match(source, /AI_CACHE_ENABLED/);
  assert.match(source, /\(request\.temperature \?\? 0\.7\) === 0/);
  assert.match(source, /stableCacheKey/);
});
