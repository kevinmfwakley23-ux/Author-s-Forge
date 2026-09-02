const test = require("node:test");
const assert = require("node:assert/strict");
const { OpenAiWebResearchProvider } = require("../.forge-build/infrastructure/openai-web-research-provider.js");

function responsePayload(claims, sources = ["https://example.org/source-a"]) {
  return {
    id: "resp-research",
    output: [
      { type: "web_search_call", action: { sources: sources.map((url) => ({ type: "url", url })) } },
      { type: "message", content: [{ type: "output_text", text: JSON.stringify({ claims }) }] },
    ],
  };
}

test("live web research requires hosted search and returns only source-verified claims", async () => {
  let request;
  const provider = new OpenAiWebResearchProvider({
    apiKey: "test-key",
    model: "research-model",
    now: () => new Date("2026-09-01T18:00:00Z"),
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify(responsePayload([
        { source: "Example Research", date: "2026-08-31", url: "https://example.org/source-a", claim: "A directly observed source-backed finding.", confidence: "high", relevance: "high" },
      ])), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await provider.research({ projectId: "book-one", domain: "historical-period", question: "What changed?" });
  assert.equal(request.model, "research-model");
  assert.deepEqual(request.tools, [{ type: "web_search", search_context_size: "high" }]);
  assert.equal(request.tool_choice, "required");
  assert.deepEqual(request.include, ["web_search_call.action.sources"]);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://example.org/source-a");
  assert.equal(result[0].confidence, "high");
});

test("live web research rejects hallucinated evidence URLs", async () => {
  const provider = new OpenAiWebResearchProvider({
    apiKey: "test-key",
    model: "research-model",
    fetchImpl: async () => new Response(JSON.stringify(responsePayload([
      { source: "Invented", date: "2026-09-01", url: "https://not-consulted.example/fake", claim: "Unsupported claim.", confidence: "high", relevance: "high" },
    ])), { status: 200, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(() => provider.research({ projectId: "book-one", domain: "technology", question: "Check this fact" }), /not returned by hosted web search/);
});

test("live web research refuses missing source sets and malformed model JSON", async () => {
  const noSources = new OpenAiWebResearchProvider({
    apiKey: "test-key", model: "research-model",
    fetchImpl: async () => new Response(JSON.stringify({ output_text: '{"claims":[]}', output: [] }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(() => noSources.research({ projectId: "book-one", domain: "geography", question: "Where is it?" }), /no verifiable web-search sources/);

  const malformed = new OpenAiWebResearchProvider({
    apiKey: "test-key", model: "research-model",
    fetchImpl: async () => new Response(JSON.stringify({ output: [
      { type: "web_search_call", action: { sources: [{ url: "https://example.org/a" }] } },
      { type: "message", content: [{ type: "output_text", text: "not-json" }] },
    ] }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(() => malformed.research({ projectId: "book-one", domain: "geography", question: "Where is it?" }), /did not return valid JSON/);
});

test("unknown publication date becomes an explicit observation date rather than an invented date", async () => {
  const provider = new OpenAiWebResearchProvider({
    apiKey: "test-key", model: "research-model", now: () => new Date("2026-09-01T23:30:00Z"),
    fetchImpl: async () => new Response(JSON.stringify(responsePayload([
      { source: "Example", url: "https://example.org/source-a", claim: "The source exposes the requested fact but no visible publication date.", confidence: "medium", relevance: "high" },
    ])), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const [result] = await provider.research({ projectId: "book-one", domain: "local-landmark", question: "What is documented?" });
  assert.equal(result.date, "2026-09-01");
});
