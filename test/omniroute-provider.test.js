import test from "node:test";
import assert from "node:assert/strict";
import { generateText } from "../dist/infrastructure/ai-provider.js";

test("OmniRoute is a real optional OpenAI-compatible provider", async () => {
  const previous = {
    endpoint: process.env.OMNIROUTE_BASE_URL,
    model: process.env.OMNIROUTE_MODEL,
    key: process.env.OMNIROUTE_API_KEY,
    billingClass: process.env.OMNIROUTE_BILLING_CLASS,
    openai: process.env.OPENAI_API_KEY,
    kings: process.env.KINGS_AI_ENDPOINT,
    ollama: process.env.OLLAMA_BASE_URL,
  };
  let requestedUrl = "";
  let requestedBody;
  const originalFetch = globalThis.fetch;
  try {
    process.env.OMNIROUTE_BASE_URL = "http://omniroute.test/";
    process.env.OMNIROUTE_MODEL = "free-or-routed-model";
    process.env.OMNIROUTE_BILLING_CLASS = "subscription";
    delete process.env.OMNIROUTE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.KINGS_AI_ENDPOINT;
    delete process.env.OLLAMA_BASE_URL;
    globalThis.fetch = async (url, init) => {
      requestedUrl = String(url);
      requestedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: "omni-test", choices: [{ message: { content: "real gateway response" } }] }), { status: 200, headers: { "content-type": "application/json" } });
    };

    const result = await generateText({ system: "system", user: "write a scene", temperature: 0 });
    assert.equal(result.provider, "omniroute");
    assert.equal(result.model, "free-or-routed-model");
    assert.equal(result.text, "real gateway response");
    assert.equal(requestedUrl, "http://omniroute.test/v1/chat/completions");
    assert.equal(requestedBody.model, "free-or-routed-model");
    assert.equal(requestedBody.messages[1].content, "write a scene");
  } finally {
    globalThis.fetch = originalFetch;
    if (previous.endpoint === undefined) delete process.env.OMNIROUTE_BASE_URL; else process.env.OMNIROUTE_BASE_URL = previous.endpoint;
    if (previous.model === undefined) delete process.env.OMNIROUTE_MODEL; else process.env.OMNIROUTE_MODEL = previous.model;
    if (previous.key === undefined) delete process.env.OMNIROUTE_API_KEY; else process.env.OMNIROUTE_API_KEY = previous.key;
    if (previous.billingClass === undefined) delete process.env.OMNIROUTE_BILLING_CLASS; else process.env.OMNIROUTE_BILLING_CLASS = previous.billingClass;
    if (previous.openai === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous.openai;
    if (previous.kings === undefined) delete process.env.KINGS_AI_ENDPOINT; else process.env.KINGS_AI_ENDPOINT = previous.kings;
    if (previous.ollama === undefined) delete process.env.OLLAMA_BASE_URL; else process.env.OLLAMA_BASE_URL = previous.ollama;
  }
});
