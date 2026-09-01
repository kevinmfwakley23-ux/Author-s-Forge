const test = require("node:test");
const assert = require("node:assert/strict");
const { createForgeCore } = require("../.forge-build/application/forge-core.js");
const { generateTextThroughCore } = require("../.forge-build/infrastructure/ai-provider.js");

function withEnv(values) {
  const previous = new Map();
  for (const [name, value] of Object.entries(values)) {
    previous.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  return () => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

test("ForgeCore-authoritative generation executes the exact broker-selected models and fails over without reverting to env model order", async () => {
  const restore = withEnv({
    ROUTER9_BASE_URL: "http://router-nine.test",
    ROUTER9_MODEL: "wrong-env-nine",
    OMNIROUTE_BASE_URL: "http://omni.test",
    OMNIROUTE_MODEL: "wrong-env-omni",
    AI_CACHE_ENABLED: "false",
  });
  const oldFetch = global.fetch;
  const observed = [];
  global.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    observed.push({ url: String(url), model: payload.model });
    if (String(url).startsWith("http://router-nine.test")) {
      return new Response(JSON.stringify({ error: { message: "invalid API key" } }), { status: 401, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ id: "omni-success", choices: [{ message: { content: "broker-routed text" } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const core = createForgeCore();
    core.registerAiModels([
      { provider: "9router", model: "selected-nine", configured: true, healthy: true, capabilities: { contextWindow: 128000, maxOutputTokens: 16000, creativeWriting: true, instructionFollowing: true } },
      { provider: "omniroute", model: "selected-omni", configured: true, healthy: true, capabilities: { contextWindow: 128000, maxOutputTokens: 16000, creativeWriting: true, instructionFollowing: true } },
    ]);

    const result = await generateTextThroughCore(core, { system: "system", user: "write", temperature: 0, maxOutputTokens: 1000 }, "writing");

    assert.equal(result.provider, "omniroute");
    assert.equal(result.model, "selected-omni");
    assert.equal(result.text, "broker-routed text");
    assert.deepEqual(observed, [
      { url: "http://router-nine.test/v1/chat/completions", model: "selected-nine" },
      { url: "http://omni.test/v1/chat/completions", model: "selected-omni" },
    ]);
    assert.equal(result.attempts.length, 2);
    assert.equal(result.attempts[0].provider, "9router");
    assert.equal(result.attempts[0].success, false);
    assert.equal(result.attempts[1].provider, "omniroute");
    assert.equal(result.attempts[1].success, true);
    assert.equal(core.routing.get("9router", "selected-nine").totalFailures, 1);
    assert.equal(core.routing.get("omniroute", "selected-omni").totalSuccesses, 1);
  } finally {
    global.fetch = oldFetch;
    restore();
  }
});

test("ForgeCore-authoritative generation never fabricates output when the core has no configured provider resources", async () => {
  await assert.rejects(
    () => generateTextThroughCore(createForgeCore(), { system: "system", user: "write" }),
    /No AI provider is configured/
  );
});
