const test = require("node:test");
const assert = require("node:assert/strict");

const { KdpMarketIntelligenceService } = require("../.forge-build/application/kdp-market-intelligence.js");
const { OpenAiWebKdpMarketIntelligenceProvider } = require("../.forge-build/infrastructure/openai-kdp-market-intelligence-provider.js");
const { createKdpMarketIntelligenceReport } = require("../.forge-build/domain/kdp-market-intelligence.js");

const sourceA = "https://kdp.amazon.com/en_US/help/topic/G201298500";
const sourceB = "https://example.org/market/childrens-friendship-books";

function researchJson(overrides = {}) {
  return {
    evidence: [
      { id: "e1", source: "Amazon KDP", url: sourceA, observation: "KDP recommends accurate reader-search keywords and allows up to seven keyword slots.", strength: "strong" },
      { id: "e2", source: "Current market sample", url: sourceB, observation: "Current observed listings show repeated reader interest around friendship and belonging stories.", strength: "moderate" },
    ],
    signals: [
      { id: "s1", topic: "keyword-opportunities", label: "Friendship search language", observation: "Reader-search wording around making friends is relevant to the proposed story niche.", direction: "positive", evidenceIds: ["e1", "e2"] },
    ],
    comparableTitles: [
      { title: "Observed Friendship Story", author: "Example Author", genre: "Children's fiction", sourceUrl: sourceB },
    ],
    keywordRecommendations: [
      { phrase: "making new friends", score: 94, rationale: "Specific reader intent and accurate to the proposed friendship story.", evidenceIds: ["e1", "e2"], recommendedForKdpSlot: true, complianceNotes: ["relevant to central storyline", "reader-search language"] },
      { phrase: "feeling safe at school", score: 87, rationale: "Specific child-centered theme for a matching story concept.", evidenceIds: ["e1"], recommendedForKdpSlot: true, complianceNotes: ["use only when story actually addresses school safety"] },
    ],
    nicheOpportunities: [
      { niche: "children's friendship and belonging stories", score: 88, demandSignal: "high", competitionSignal: "moderate", rationale: "Observed reader interest with room for differentiated Heartwood-style treatment.", evidenceIds: ["e2"] },
    ],
    assessment: { level: "promising", rationale: "There are useful current signals, but the evidence does not guarantee future sales.", signals: ["friendship search intent"], limitations: ["retailer demand and competition can change quickly"] },
    ...overrides,
  };
}

function openAiPayload(data = researchJson(), extraSources = []) {
  return {
    id: "resp-market-1",
    output: [
      { type: "web_search_call", id: "ws-1", status: "completed", action: { type: "search", sources: [{ type: "url", url: sourceA }, { type: "url", url: sourceB }, ...extraSources] } },
      { type: "message", content: [{ type: "output_text", text: JSON.stringify(data) }] },
    ],
  };
}

function providerWith(payload) {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    return { ok: true, status: 200, json: async () => payload };
  };
  return { requests, provider: new OpenAiWebKdpMarketIntelligenceProvider({ apiKey: "test-key", model: "gpt-test", fetchImpl, now: () => new Date("2026-09-01T10:00:00.000Z") }) };
}

test("live KDP research requires current hosted web search and returns ranked keyword/niche evidence", async () => {
  const { provider, requests } = providerWith(openAiPayload());
  const service = new KdpMarketIntelligenceService(provider);
  const report = await service.research({ id: "market-1", projectId: "project-1", bookId: "book-1", market: "Amazon.com / US children's books", question: "Find current children's friendship niches and KDP keywords." });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.openai.com/v1/responses");
  assert.deepEqual(requests[0].body.tools, [{ type: "web_search", search_context_size: "high" }]);
  assert.equal(requests[0].body.tool_choice, "required", "live market research must not let the model skip web search");
  assert.deepEqual(requests[0].body.include, ["web_search_call.action.sources"]);
  assert.match(requests[0].body.input[0].content, /up to seven keyword slots/i);
  assert.match(requests[0].body.input[0].content, /not guaranteed future sales/i);

  assert.equal(report.keywordRecommendations.length, 2);
  assert.equal(report.keywordRecommendations[0].phrase, "making new friends");
  assert.equal(report.keywordRecommendations[0].recommendedForKdpSlot, true);
  assert.equal(report.nicheOpportunities[0].niche, "children's friendship and belonging stories");
  assert.equal(report.nicheOpportunities[0].score, 88);
  assert.equal(report.evidence[0].observedAt, "2026-09-01T10:00:00.000Z");
  assert.match(report.assessment.disclaimer, /not a guarantee/i);
});

test("live KDP research rejects hallucinated evidence URLs not returned by web search", async () => {
  const bad = researchJson({ evidence: [{ id: "e1", source: "Invented", url: "https://invented.invalid/fake", observation: "Fabricated source.", strength: "strong" }] });
  const { provider } = providerWith(openAiPayload(bad));
  await assert.rejects(() => provider.research({ projectId: "project-1", market: "US", question: "Research niches" }), /not returned by the web-search tool/i);
});

test("domain enforces no more than seven selected KDP keyword slots and blocks promotional metadata", () => {
  const base = researchJson();
  const eight = Array.from({ length: 8 }, (_, index) => ({ phrase: `friendship theme ${index + 1}`, score: 90 - index, rationale: "Relevant reader phrase.", evidenceIds: ["e1"], recommendedForKdpSlot: true, complianceNotes: [] }));
  assert.throws(() => createKdpMarketIntelligenceReport({ id: "too-many", projectId: "project-1", question: "q", market: "US", ...base, keywordRecommendations: eight }), /At most seven keyword recommendations/i);
  assert.throws(() => createKdpMarketIntelligenceReport({ id: "promo", projectId: "project-1", question: "q", market: "US", ...base, keywordRecommendations: [{ phrase: "free bestselling friendship book", score: 90, rationale: "bad", evidenceIds: ["e1"], recommendedForKdpSlot: true, complianceNotes: [] }] }), /prohibited or promotional metadata/i);
});