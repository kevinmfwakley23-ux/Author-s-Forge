const test = require("node:test");
const assert = require("node:assert/strict");
const { generateText, aiRoutingTelemetry, aiConfiguredProviderQuotas } = require("../dist/infrastructure/ai-provider.js");

const PROVIDER_ENV = [
  "OMNIROUTE_BASE_URL", "OMNIROUTE_API_KEY", "OMNIROUTE_MODEL", "OMNIROUTE_MODELS", "OMNIROUTE_TOKEN_QUOTA", "OMNIROUTE_USED_TOKENS", "OMNIROUTE_REMAINING_TOKENS", "OMNIROUTE_BILLING_CLASS",
  "ROUTER9_BASE_URL", "ROUTER9_API_KEY", "ROUTER9_MODEL", "ROUTER9_MODELS", "ROUTER9_TOKEN_QUOTA", "ROUTER9_USED_TOKENS", "ROUTER9_REMAINING_TOKENS", "ROUTER9_BILLING_CLASS",
  "KINGS_AI_ENDPOINT", "KINGS_AI_RESPONSES_URL", "KINGS_AI_MODEL", "KINGS_AI_MODELS",
  "OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_MODELS",
  "OLLAMA_BASE_URL", "OLLAMA_MODEL", "OLLAMA_MODELS", "OLLAMA_BILLING_CLASS",
  "AI_PROVIDER_ORDER", "AI_ROUTING_MODE", "AI_QUOTA_SAFETY_FRACTION", "AI_MODEL_RESOURCES_JSON", "AI_CACHE_ENABLED", "AI_PROVIDER_TIMEOUT_MS", "AI_SPEND_POLICY",
];

function isolatedEnv(values) {
  const before = new Map(PROVIDER_ENV.map((name) => [name, process.env[name]]));
  for (const name of PROVIDER_ENV) delete process.env[name];
  Object.assign(process.env, values);
  return () => {
    for (const name of PROVIDER_ENV) {
      const value = before.get(name);
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  };
}

test("hermetic AI routing fails over between configured models and accounts provider-reported tokens", { concurrency: false }, async () => {
  const restoreEnv = isolatedEnv({
    OMNIROUTE_BASE_URL: "http://omniroute.test/v1",
    OMNIROUTE_MODELS: "a-fail,b-good",
    OMNIROUTE_BILLING_CLASS: "subscription",
    AI_PROVIDER_ORDER: "omniroute",
    AI_ROUTING_MODE: "economy",
  });
  const oldFetch = global.fetch;
  const seen = [];
  global.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    seen.push({ url: String(url), model: payload.model, maxTokens: payload.max_tokens });
    if (payload.model === "a-fail") {
      return new Response(JSON.stringify({ error: { message: "rate limit" } }), { status: 429, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      id: "ok-1",
      choices: [{ message: { content: "real generated answer" } }],
      usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const result = await generateText({ system: "System context", user: "Write the answer.", task: "writing", maxOutputTokens: 64 });
    assert.equal(result.provider, "omniroute");
    assert.equal(result.model, "b-good");
    assert.equal(result.text, "real generated answer");
    assert.deepEqual(seen.map((item) => item.model), ["a-fail", "b-good"]);
    assert.ok(seen.every((item) => item.url.endsWith("/v1/chat/completions")));
    assert.ok(seen.every((item) => !item.url.includes("/v1/v1/")));
    assert.ok(seen.every((item) => item.maxTokens === 64));
    assert.equal(result.attempts.length, 2);
    assert.equal(result.attempts[0].success, false);
    assert.equal(result.attempts[1].success, true);
    assert.equal(result.usage.totalTokens, 17);
    assert.equal(result.routing.accountedTokens, 17);
    assert.equal(result.routing.usageSource, "provider");
    const telemetry = aiRoutingTelemetry();
    assert.ok(telemetry.find((item) => item.provider === "omniroute" && item.model === "a-fail").consecutiveFailures >= 1);
    assert.equal(telemetry.find((item) => item.provider === "omniroute" && item.model === "b-good").totalTokens, 17);
  } finally {
    global.fetch = oldFetch;
    restoreEnv();
  }
});

test("hermetic AI routing rotates to a less-used eligible model before either model is exhausted", { concurrency: false }, async () => {
  const restoreEnv = isolatedEnv({
    OMNIROUTE_BASE_URL: "http://omniroute-rotate.test/v1",
    OMNIROUTE_MODELS: "rotate-a,rotate-b",
    OMNIROUTE_BILLING_CLASS: "subscription",
    AI_PROVIDER_ORDER: "omniroute",
    AI_ROUTING_MODE: "balanced",
  });
  const oldFetch = global.fetch;
  const seen = [];
  global.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    seen.push(payload.model);
    return new Response(JSON.stringify({
      id: `rotation-${seen.length}`,
      choices: [{ message: { content: `result from ${payload.model}` } }],
      usage: { prompt_tokens: 60, completion_tokens: 40, total_tokens: 100 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const first = await generateText({ system: "System", user: "First request", task: "writing", maxOutputTokens: 100 });
    const second = await generateText({ system: "System", user: "Second request", task: "writing", maxOutputTokens: 100 });
    assert.equal(first.model, "rotate-a");
    assert.equal(second.model, "rotate-b");
    assert.deepEqual(seen, ["rotate-a", "rotate-b"]);
  } finally {
    global.fetch = oldFetch;
    restoreEnv();
  }
});

test("hermetic AI routing protects one shared OmniRoute quota across multiple models", { concurrency: false }, async () => {
  const restoreEnv = isolatedEnv({
    OMNIROUTE_BASE_URL: "http://omniroute-quota.test/v1",
    OMNIROUTE_MODELS: "nearly-empty-a,nearly-empty-b",
    OMNIROUTE_TOKEN_QUOTA: "1000",
    OMNIROUTE_USED_TOKENS: "850",
    OMNIROUTE_BILLING_CLASS: "subscription",
    ROUTER9_BASE_URL: "http://router9-safe.test/v1",
    ROUTER9_MODEL: "safe-model",
    ROUTER9_TOKEN_QUOTA: "10000",
    ROUTER9_USED_TOKENS: "0",
    ROUTER9_BILLING_CLASS: "subscription",
    AI_PROVIDER_ORDER: "omniroute,9router",
    AI_QUOTA_SAFETY_FRACTION: "0.10",
  });
  const oldFetch = global.fetch;
  const seen = [];
  global.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    seen.push({ url: String(url), model: payload.model });
    return new Response(JSON.stringify({
      id: "ok-2",
      choices: [{ message: { content: "quota-safe answer" } }],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const before = aiConfiguredProviderQuotas().find((quota) => quota.scope === "omniroute");
    assert.equal(before.remainingQuota, 150);
    const result = await generateText({ system: "Short system", user: "Short user request", task: "writing", maxOutputTokens: 100 });
    assert.equal(result.provider, "9router");
    assert.equal(result.model, "safe-model");
    assert.equal(seen.length, 1);
    assert.match(seen[0].url, /router9-safe/);
    assert.equal(result.routing.accountedTokens, 18);
  } finally {
    global.fetch = oldFetch;
    restoreEnv();
  }
});

test("hermetic Ollama connector sends broker output budget as num_predict", { concurrency: false }, async () => {
  const restoreEnv = isolatedEnv({
    OLLAMA_BASE_URL: "http://ollama.test",
    OLLAMA_MODEL: "local-writer",
    AI_PROVIDER_ORDER: "ollama",
  });
  const oldFetch = global.fetch;
  let requestBody;
  global.fetch = async (url, options) => {
    assert.equal(String(url), "http://ollama.test/api/chat");
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      message: { content: "A complete locally generated answer with enough detail to satisfy the writing request." },
      prompt_eval_count: 20,
      eval_count: 30,
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await generateText({ system: "System", user: "Write a concise useful paragraph.", task: "writing", maxOutputTokens: 123 });
    assert.equal(result.provider, "ollama");
    assert.equal(requestBody.options.num_predict, 123);
    assert.equal(requestBody.options.temperature, 0.7);
    assert.equal(result.routing.accountedTokens, 50);
  } finally {
    global.fetch = oldFetch;
    restoreEnv();
  }
});
