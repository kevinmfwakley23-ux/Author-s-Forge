const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm, readFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { FileAiModelPerformanceStore } = require("../dist/infrastructure/file-ai-model-performance-store.js");
const { createAiEnsemblePerformanceTracker } = require("../dist/application/ai-ensemble-performance.js");

function quality(score) {
  return { version: 1, accepted: score >= 70, score, failures: [], warnings: [] };
}
function resources() {
  return [
    { provider:"ollama", model:"writer", configured:true, healthy:true, billingClass:"local", capabilities:{ creativeWriting:true, instructionFollowing:true } },
    { provider:"gateway", model:"home::judge", configured:true, healthy:true, billingClass:"free", capabilities:{ instructionFollowing:true } },
  ];
}

test("ensemble performance tracker records actual model evidence without storing prompt or manuscript text", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-model-performance-"));
  try {
    const path = join(root, "performance.json");
    const store = new FileAiModelPerformanceStore(path);
    const tracker = createAiEnsemblePerformanceTracker({
      projectId: "project-1",
      task: "rewrite",
      store,
      qualityFloor: 80,
      ensembleId: "ensemble-test-1",
      resources: resources(),
      delegate: async (request) => {
        if (request.system.includes("ENSEMBLE ROLE:")) {
          return { provider:"ollama", model:"writer", text:"A complete candidate preserving the established promise and scene intent without introducing contradictory facts.", quality:quality(92) };
        }
        if (request.task === "continuity") {
          return { provider:"gateway", model:"home::judge", text:JSON.stringify({ accepted:true, score:95, failures:[], warnings:[], evidence:["canon retained"] }), quality:quality(90) };
        }
        if (request.task === "voice-preservation") {
          return { provider:"gateway", model:"home::judge", text:JSON.stringify({ accepted:false, score:72, failures:["rhythm drift"], warnings:[], evidence:[] }), quality:quality(90) };
        }
        throw new Error("unexpected phase");
      },
    });

    const secretPrompt = "PRIVATE MANUSCRIPT SENTENCE THAT MUST NEVER ENTER PERFORMANCE STORAGE";
    await tracker.generate({ system:`ENSEMBLE ROLE:\n${secretPrompt}`, user:secretPrompt, task:"writing", preferProvider:"ollama", preferModel:"writer" });
    await tracker.generate({ system:"INDEPENDENT ANTI-DRIFT JUDGE.", user:secretPrompt, task:"continuity", preferProvider:"gateway", preferModel:"home::judge" });
    await tracker.generate({ system:"INDEPENDENT ANTI-DRIFT JUDGE.", user:secretPrompt, task:"voice-preservation", preferProvider:"gateway", preferModel:"home::judge" });

    const written = await tracker.flush();
    assert.equal(written.length, 3);
    const listed = await store.list("project-1");
    assert.equal(listed.length, 3);
    assert.equal(listed.find((item) => item.phase === "candidate").accepted, true);
    assert.equal(listed.find((item) => item.phase === "judge-continuity").qualityScore, 95);
    assert.equal(listed.find((item) => item.phase === "judge-voice").accepted, false);

    const raw = await readFile(path, "utf8");
    assert.equal(raw.includes(secretPrompt), false, "performance ledger must not contain prompts/manuscript text");
    assert.equal(raw.includes("rhythm drift"), false, "performance ledger stores outcome metrics, not judge prose");

    const aggregates = await store.aggregate("project-1", 2);
    const judge = aggregates.find((item) => item.provider === "gateway" && item.model === "home::judge");
    assert.ok(judge);
    assert.equal(judge.samples, 2);
    assert.equal(judge.passRate, 0.5);
    assert.equal(judge.recommendationEvidence, "usable");
  } finally {
    await rm(root, { recursive:true, force:true });
  }
});

test("attributable provider failures are recorded as failed evidence and are rethrown", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-model-performance-failure-"));
  try {
    const store = new FileAiModelPerformanceStore(join(root, "performance.json"));
    const tracker = createAiEnsemblePerformanceTracker({
      projectId:"project-1",
      task:"draft",
      store,
      qualityFloor:80,
      ensembleId:"ensemble-failure-1",
      resources:resources(),
      delegate: async () => { throw new Error("provider unavailable"); },
    });
    await assert.rejects(() => tracker.generate({ system:"ENSEMBLE ROLE:", user:"draft", task:"writing", preferProvider:"ollama", preferModel:"writer" }), /provider unavailable/);
    await tracker.flush();
    const listed = await store.list("project-1");
    assert.equal(listed.length, 1);
    assert.equal(listed[0].provider, "ollama");
    assert.equal(listed[0].model, "writer");
    assert.equal(listed[0].accepted, false);
  } finally {
    await rm(root, { recursive:true, force:true });
  }
});
