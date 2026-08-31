import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryRecord } from "../dist/domain/memory.js";
import { createKnowledgeGapRadarReport } from "../dist/domain/knowledge-gap-radar.js";

const now = "2026-08-31T06:00:00.000Z";
const memory = (input) => createMemoryRecord({ projectId: "p1", authority: "working", provenance: [{ kind: "author", reference: "test", recordedAt: now }], now, relatedMemoryIds: [], relevanceTags: [], ...input });

test("Knowledge Gap Radar surfaces unsupported hypotheses and open questions without declaring them false", () => {
  const hypothesis = memory({ id: "h1", class: "hypothesis", summary: "The old bridge opened in 1934", content: "The old bridge opened in 1934.", relevanceTags: ["historical-period", "bridge"] });
  const thread = memory({ id: "q1", class: "open-thread", summary: "Verify winter access", content: "Was the canyon road open during winters in 1993?", relevanceTags: ["travel-distance", "canyon"] });
  const report = createKnowledgeGapRadarReport({ projectId: "p1", memories: [hypothesis, thread], now });
  assert.equal(report.signals.length, 2);
  assert.equal(report.signals[0].kind, "unsupported-claim");
  assert.equal(report.signals[0].severity, "high");
  assert.equal(report.signals[0].suggestedDomain, "historical-period");
  assert.match(report.signals[0].rationale, /no related source-backed research/i);
  const open = report.signals.find((item) => item.kind === "open-question");
  assert.equal(open?.suggestedQuestion, "Was the canyon road open during winters in 1993?");
});

test("source-backed related research removes an unsupported-claim gap but can remain weak evidence", () => {
  const claim = memory({ id: "claim", class: "project-memory", summary: "Bridge opening year", content: "The bridge opened in 1934.", relevanceTags: ["bridge", "historical-period"] });
  const research = createMemoryRecord({ id: "research:1", projectId: "p1", class: "research-memory", authority: "working", summary: "A city archive lists a 1934 opening", content: "source claim", provenance: [{ kind: "source", reference: "https://example.com/archive", recordedAt: now }], relatedMemoryIds: ["claim"], relevanceTags: ["bridge", "historical-period"], now });
  const report = createKnowledgeGapRadarReport({ projectId: "p1", memories: [claim, research], now });
  assert.equal(report.signals.some((item) => item.kind === "unsupported-claim"), false);
  const weak = report.signals.find((item) => item.kind === "weak-evidence");
  assert.equal(weak?.evidenceMemoryIds[0], "research:1");
});

test("verified research satisfies the radar evidence threshold", () => {
  const claim = memory({ id: "claim", class: "project-memory", summary: "Bridge opening year", content: "The bridge opened in 1934.", relevanceTags: ["bridge"] });
  const research = createMemoryRecord({ id: "research:verified", projectId: "p1", class: "research-memory", authority: "verified", summary: "Archive confirms bridge opening", content: "verified source claim", provenance: [{ kind: "source", reference: "https://example.com/archive", recordedAt: now }], relatedMemoryIds: ["claim"], relevanceTags: ["bridge"], now });
  const report = createKnowledgeGapRadarReport({ projectId: "p1", memories: [claim, research], now });
  assert.deepEqual(report.signals, []);
});

test("radar ignores archived and superseded project state", () => {
  const archived = createMemoryRecord({ id: "old", projectId: "p1", class: "hypothesis", authority: "archived", summary: "Obsolete claim", content: "Obsolete claim.", provenance: [{ kind: "author", reference: "test", recordedAt: now }], now });
  const report = createKnowledgeGapRadarReport({ projectId: "p1", memories: [archived], now });
  assert.deepEqual(report.signals, []);
});

test("radar refuses cross-project memory mixtures", () => {
  const foreign = createMemoryRecord({ id: "foreign", projectId: "p2", class: "hypothesis", authority: "working", summary: "Foreign claim", content: "Foreign claim.", provenance: [{ kind: "author", reference: "test", recordedAt: now }], now });
  assert.throws(() => createKnowledgeGapRadarReport({ projectId: "p1", memories: [foreign], now }), /cannot mix memories from different projects/i);
});
