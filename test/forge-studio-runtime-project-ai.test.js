const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createForgeStudioRuntime } = require("../.forge-build/infrastructure/forge-studio-runtime.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");

function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test("Studio runtime routes project-aware generation through the shared ForgeCore broker", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-project-ai-"));
  const originalFetch = global.fetch;
  const calls = [];
  try {
    await withEnv({
      OMNIROUTE_BASE_URL: "http://forge-router.invalid",
      OMNIROUTE_MODEL: "writer-model",
      AI_PROVIDER_ORDER: "openai,ollama,omniroute",
      OPENAI_API_KEY: undefined,
      OPENAI_MODEL: undefined,
      OLLAMA_BASE_URL: undefined,
      OLLAMA_MODEL: undefined,
      AI_CACHE_ENABLED: "false",
    }, async () => {
      global.fetch = async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({
          id: "req-core-project",
          choices: [{ message: { content: "Draft grounded in lighthouse canon." } }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      };

      const runtime = createForgeStudioRuntime(root, process.env);
      const memory = new ProjectMemoryStore();
      memory.register(createMemoryRecord({
        id: "canon-lighthouse",
        projectId: "project-1",
        class: "story-canon",
        authority: "authoritative",
        summary: "Lighthouse canon",
        content: "The lighthouse stands on the north shore.",
        provenance: [{ kind: "author", reference: "canon", recordedAt: "2026-09-01T00:00:00.000Z" }],
        now: "2026-09-01T00:00:00.000Z",
      }));

      const result = await runtime.generateProjectText({
        memory,
        context: { projectId: "project-1" },
        system: "Preserve approved canon.",
        user: "Draft the arrival scene.",
        temperature: 0.7,
        maxOutputTokens: 500,
      });

      assert.equal(result.provider, "omniroute");
      assert.equal(result.model, "writer-model");
      assert.equal(result.text, "Draft grounded in lighthouse canon.");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "http://forge-router.invalid/v1/chat/completions");
      assert.equal(calls[0].body.model, "writer-model");
      assert.match(calls[0].body.messages[0].content, /lighthouse stands on the north shore/i);
      assert.ok(result.attempts?.some((attempt) => attempt.provider === "omniroute" && attempt.success));
    });
  } finally {
    global.fetch = originalFetch;
    await rm(root, { recursive: true, force: true });
  }
});
