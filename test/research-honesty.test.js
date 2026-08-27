const test = require("node:test");
const assert = require("node:assert/strict");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");
const { ResearchHonestyService } = require("../.forge-build/application/research-honesty.js");
const { createResearchHonestyRecord, isResearchHonest } = require("../.forge-build/domain/research-honesty.js");

test("supports all five research honesty classes", () => {
  const cases = [
    ["known-fact", "direct", true, true],
    ["source-supported", "direct", true, true],
    ["likely-inference", "indirect", true, false],
    ["creative-fiction", "none", false, false],
    ["uncertain", "indirect", false, false],
  ];
  for (const [classification, evidenceStrength, sourceBacked, canonEligible] of cases) {
    const record = createResearchHonestyRecord({ id: `h-${classification}`, projectId: "p1", claimId: "c1", classification, evidenceStrength, sourceBacked, explanation: "Explicitly classified research knowledge.", now: "2026-01-01T00:00:00.000Z" });
    assert.equal(record.assessment.canonEligible, canonEligible);
    assert.equal(isResearchHonest(record), true);
  }
});

test("rejects dishonest fact and fiction classifications", () => {
  assert.throws(() => createResearchHonestyRecord({ id: "bad1", projectId: "p1", claimId: "c1", classification: "known-fact", evidenceStrength: "none", sourceBacked: false, explanation: "No evidence." }), /Known facts require source-backed evidence/);
  assert.throws(() => createResearchHonestyRecord({ id: "bad2", projectId: "p1", claimId: "c1", classification: "creative-fiction", evidenceStrength: "direct", sourceBacked: true, explanation: "Source says this fictional event happened." }), /Creative fiction cannot be represented as source-backed research/);
  assert.throws(() => createResearchHonestyRecord({ id: "bad3", projectId: "p1", claimId: "c1", classification: "likely-inference", evidenceStrength: "none", sourceBacked: false, explanation: "Guess." }), /Likely inference requires at least indirect evidence/);
});

test("persists, filters, isolates, and summarizes honesty assessments", () => {
  const store = new ProjectMemoryStore();
  const service = new ResearchHonestyService(store);
  service.assess({ id: "a", projectId: "p1", claimId: "c1", classification: "known-fact", evidenceStrength: "direct", sourceBacked: true, explanation: "Documented fact." });
  service.assess({ id: "b", projectId: "p1", claimId: "c2", classification: "likely-inference", evidenceStrength: "indirect", sourceBacked: true, explanation: "Reasoned inference." });
  service.assess({ id: "c", projectId: "p2", claimId: "c3", classification: "uncertain", evidenceStrength: "indirect", sourceBacked: false, explanation: "Not established." });
  assert.equal(service.get({ projectId: "p1" }).length, 2);
  assert.equal(service.get({ projectId: "p1", classification: "known-fact" })[0].claimId, "c1");
  assert.equal(service.get({ projectId: "p2" }).length, 1);
  assert.deepEqual(service.summarize("p1"), { projectId: "p1", total: 2, byClassification: { "known-fact": 1, "source-supported": 0, "likely-inference": 1, "creative-fiction": 0, "uncertain": 0 }, canonEligible: 1, nonCanonEligible: 1 });
});

test("honesty records remain working research memory and never silently become canon", () => {
  const store = new ProjectMemoryStore();
  const service = new ResearchHonestyService(store);
  service.assess({ id: "a", projectId: "p1", claimId: "c1", classification: "source-supported", evidenceStrength: "direct", sourceBacked: true, explanation: "Supported by retained research." });
  const memory = store.get("research-honesty:a");
  assert.ok(memory);
  assert.equal(memory.authority, "working");
  assert.equal(memory.class, "research-memory");
  assert.equal(memory.provenance[0].reference, "c1");
});
