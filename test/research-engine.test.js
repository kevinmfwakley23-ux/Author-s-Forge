const assert = require("node:assert/strict");
const test = require("node:test");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { ResearchEngine, StaticResearchProvider } = require("../.forge-build/application/research-engine.js");
const { createResearchClaim } = require("../.forge-build/domain/research.js");

function engine(results = [{ source: "National Archives", date: "2026-08-20", url: "https://example.org/history", claim: "The location was established in 1890.", confidence: "high", relevance: "high" }]) {
  return new ResearchEngine(new StaticResearchProvider(results), new ProjectMemoryStore());
}

test("research records preserve source, date, URL, claim, confidence, relevance, and project link", async () => {
  const e = engine();
  const result = await e.research({ id: "research-1", projectId: "project-1", question: "When was the location established?", researchedBecause: "Chapter 12 takes place here.", domain: "historical-event", bookId: "book-1", chapterId: "chapter-12" });
  assert.equal(result.record.claims[0].source, "National Archives");
  assert.equal(result.record.claims[0].url, "https://example.org/history");
  assert.equal(result.record.claims[0].projectId, "project-1");
  assert.equal(result.record.claims[0].bookId, "book-1");
  assert.equal(result.record.claims[0].chapterId, "chapter-12");
  assert.equal(result.record.claims[0].researchedBecause, "Chapter 12 takes place here.");
});

test("research becomes persistent project knowledge and can be retrieved without repeating investigation", async () => {
  const store = new ProjectMemoryStore();
  let calls = 0;
  const provider = { async research() { calls += 1; return [{ source: "Travel Authority", date: "2026-08-21", url: "https://example.org/distance", claim: "The route is 18 miles.", confidence: "medium", relevance: "high" }]; } };
  const e = new ResearchEngine(provider, store);
  await e.research({ id: "distance-1", projectId: "project-1", question: "How far?", researchedBecause: "Chapter 12 travel scene.", domain: "travel-distance", sceneId: "scene-12" });
  const retrieved = e.retrieve("project-1", { sceneId: "scene-12" });
  assert.equal(calls, 1);
  assert.equal(retrieved[0].claim, "The route is 18 miles.");
  assert.equal(retrieved[0].url, "https://example.org/distance");
});

test("research is isolated by project and book, chapter, and scene scope", async () => {
  const store = new ProjectMemoryStore();
  const provider = new StaticResearchProvider([
    { source: "A", date: "2026-08-01", url: "https://example.org/a", claim: "A fact", confidence: "high", relevance: "high" }
  ]);
  const e = new ResearchEngine(provider, store);
  await e.research({ id: "r-a", projectId: "p1", question: "A?", researchedBecause: "Book A needs it.", domain: "geography", bookId: "book-a", chapterId: "chapter-a" });
  assert.equal(e.retrieve("p2").length, 0);
  assert.equal(e.retrieve("p1", { bookId: "book-b" }).length, 0);
  assert.equal(e.retrieve("p1", { bookId: "book-a", chapterId: "chapter-a" }).length, 1);
});

test("research rejects malformed source URLs and invalid dates", () => {
  assert.throws(() => createResearchClaim({ id: "bad", projectId: "p1", source: "Source", date: "not-a-date", url: "https://example.org", claim: "Fact", confidence: "high", relevance: "high", domain: "geography", researchQuestion: "Q", researchedBecause: "R" }), /valid date/);
  assert.throws(() => createResearchClaim({ id: "bad-url", projectId: "p1", source: "Source", date: "2026-08-01", url: "file:///secret", claim: "Fact", confidence: "high", relevance: "high", domain: "geography", researchQuestion: "Q", researchedBecause: "R" }), /http or https/);
});

test("research engine rejects empty provider results", async () => {
  const e = engine([]);
  await assert.rejects(() => e.research({ id: "empty", projectId: "p1", question: "Q", researchedBecause: "Scene need.", domain: "geography" }), /no results/);
});

test("research memory is explicitly non-canon working knowledge with source provenance", async () => {
  const store = new ProjectMemoryStore();
  const e = new ResearchEngine(new StaticResearchProvider([{ source: "Source", date: "2026-08-01", url: "https://example.org/fact", claim: "A fact", confidence: "high", relevance: "high" }]), store);
  const result = await e.research({ id: "r", projectId: "p1", question: "Q", researchedBecause: "A scene.", domain: "geography" });
  const memory = result.memories[0];
  assert.equal(memory.class, "research-memory");
  assert.equal(memory.authority, "working");
  assert.equal(memory.provenance[0].kind, "source");
  assert.equal(memory.provenance[0].reference, "https://example.org/fact");
});

test("duplicate research identifiers are rejected instead of silently replacing knowledge", async () => {
  const store = new ProjectMemoryStore();
  const e = new ResearchEngine(new StaticResearchProvider([{ source: "Source", date: "2026-08-01", url: "https://example.org/fact", claim: "A fact", confidence: "high", relevance: "high" }]), store);
  const request = { id: "duplicate", projectId: "p1", question: "Q", researchedBecause: "A scene.", domain: "geography" };
  await e.research(request);
  await assert.rejects(() => e.research(request), /Duplicate memory id/);
});
