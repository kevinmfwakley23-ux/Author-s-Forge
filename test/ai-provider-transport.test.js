const test = require("node:test");
const assert = require("node:assert/strict");
const {
  providerFetch,
  readAiProviderTimeoutMs,
  AiProviderTransportError,
} = require("../dist/infrastructure/provider-transport.js");

test("AI provider timeout configuration fails closed on invalid bounds", () => {
  assert.equal(readAiProviderTimeoutMs(undefined), 120000);
  assert.equal(readAiProviderTimeoutMs("5000"), 5000);
  assert.throws(() => readAiProviderTimeoutMs("999"), /1000 to 600000/);
  assert.throws(() => readAiProviderTimeoutMs("not-a-number"), /1000 to 600000/);
});

test("provider transport classifies an actual AbortSignal timeout as retryable", { concurrency: false }, async () => {
  const oldFetch = global.fetch;
  global.fetch = async (_input, options) => new Promise((_resolve, reject) => {
    const signal = options.signal;
    if (signal.aborted) return reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  try {
    await assert.rejects(
      () => providerFetch("http://hung-provider.test", {}, { timeoutMs: 10, label: "hung-test" }),
      (error) => {
        assert.ok(error instanceof AiProviderTransportError);
        assert.equal(error.code, "AI_PROVIDER_TIMEOUT");
        assert.equal(error.retryable, true);
        assert.match(error.message, /timed out after 10ms/);
        return true;
      },
    );
  } finally {
    global.fetch = oldFetch;
  }
});

test("provider transport normalizes network failures as retryable", { concurrency: false }, async () => {
  const oldFetch = global.fetch;
  global.fetch = async () => { throw new TypeError("fetch failed"); };
  try {
    await assert.rejects(
      () => providerFetch("http://offline-provider.test", {}, { timeoutMs: 100, label: "offline-test" }),
      (error) => {
        assert.ok(error instanceof AiProviderTransportError);
        assert.equal(error.code, "AI_PROVIDER_NETWORK");
        assert.equal(error.retryable, true);
        assert.match(error.message, /network request failed/i);
        return true;
      },
    );
  } finally {
    global.fetch = oldFetch;
  }
});
