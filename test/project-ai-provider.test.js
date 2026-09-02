const test = require("node:test");
const assert = require("node:assert/strict");
const { createMemoryRecord } = require("../dist/domain/memory.js");
const { ProjectMemoryStore } = require("../dist/application/project-memory-store.js");
const { generateProjectText } = require("../dist/infrastructure/ai-provider.js");

function withEnv(name, value) {
  const old = process.env[name];
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
  return () => { if (old === undefined) delete process.env[name]; else process.env[name] = old; };
}

test("project-aware AI generation retrieves and budgets project context before provider dispatch", async () => {
  const restoreKey = withEnv("OPENAI_API_KEY", "test-key");
  const restoreModel = withEnv("OPENAI_MODEL", "test-model");
  const restoreKings = withEnv("KINGS_AI_ENDPOINT", undefined);
  const oldFetch = global.fetch;
  let captured;
  global.fetch = async (_url, options) => {
    captured = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: "resp_test", output_text: "generated" }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const store = new ProjectMemoryStore();
    store.register(createMemoryRecord({
      id: "canon-hero",
      projectId: "project-1",
      class: "story-canon",
      authority: "authoritative",
      summary: "Hero identity",
      content: "The protagonist is Mara Vale.",
      provenance: [{ kind: "author", reference: "author-note-1", recordedAt: "2026-08-28T00:00:00.000Z" }],
      relevanceTags: ["hero"],
    }));
    store.register(createMemoryRecord({
      id: "other-project",
      projectId: "project-2",
      class: "story-canon",
      authority: "authoritative",
      summary: "Other project",
      content: "This must never enter project one context.",
      provenance: [{ kind: "author", reference: "author-note-2", recordedAt: "2026-08-28T00:00:00.000Z" }],
    }));

    // This test exercises Project Brain context assembly rather than owner billing
    // policy, so the mocked provider is explicitly allowed. Production calls
    // that omit this field still default to no-paid-tokens.
    const result = await generateProjectText({
      memory: store,
      context: { projectId: "project-1", relevanceTags: ["hero"] },
      contextBudget: 1000,
      user: "Draft the next scene with Mara.",
      spendPolicy: "unrestricted",
    });

    assert.equal(result.text, "generated");
    assert.equal(result.provider, "openai");
    assert.match(captured.input[0].content, /Mara Vale/);
    assert.doesNotMatch(captured.input[0].content, /Other project|must never enter/);
    assert.match(captured.input[1].content, /Draft the next scene/);
    assert.ok(result.optimization);
    assert.ok(result.optimization.strategy.includes("project-brain-retrieval"));
    assert.ok(result.optimization.strategy.includes("priority-context-budget"));
  } finally {
    global.fetch = oldFetch;
    restoreKey();
    restoreModel();
    restoreKings();
  }
});
