const test = require("node:test");
const assert = require("node:assert/strict");
const { generateText } = require("../dist/infrastructure/ai-provider.js");

test("AI provider refuses to pretend when no real provider is configured", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldModel = process.env.OPENAI_MODEL;
  const oldOllama = process.env.OLLAMA_BASE_URL;
  const oldOllamaModel = process.env.OLLAMA_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_MODEL;
  await assert.rejects(() => generateText({ system: "test", user: "test" }), /No AI provider is configured/);
  if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  if (oldModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = oldModel;
  if (oldOllama === undefined) delete process.env.OLLAMA_BASE_URL; else process.env.OLLAMA_BASE_URL = oldOllama;
  if (oldOllamaModel === undefined) delete process.env.OLLAMA_MODEL; else process.env.OLLAMA_MODEL = oldOllamaModel;
});
