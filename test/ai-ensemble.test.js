const test = require("node:test");
const assert = require("node:assert/strict");
const {
  runAiTextEnsemble,
  parseAiEnsembleJudge,
  selectDiverseEnsembleCandidates,
} = require("../dist/application/ai-ensemble.js");

function quality(score = 95) {
  return { version: 1, accepted: score >= 70, score, failures: [], warnings: [] };
}
function resource(provider, model, billingClass = "free") {
  return {
    provider,
    model,
    configured: true,
    healthy: true,
    billingClass,
    capabilities: { creativeWriting: true, instructionFollowing: true, longContext: true },
  };
}
function options(overrides = {}) {
  return {
    formatVersion: 1,
    additionalModels: [],
    trustedNoSpendModels: [],
    ensembleEnabled: true,
    ensembleMaxWorkers: 3,
    ensembleMinQualityScore: 80,
    updatedAt: "2026-09-04T17:00:00.000Z",
    ...overrides,
  };
}
function request() {
  return {
    system: "Preserve canon and the author's voice.",
    user: "Rewrite this scene with tighter pacing but keep the established meaning and emotional intent.",
    sourceText: "Mara opened the archive door slowly. She remembered why she had promised not to enter alone.",
    projectId: "p1",
    title: "Archive scene",
    maxOutputTokens: 1200,
  };
}

test("diverse selection prefers different providers before additional models from one provider", () => {
  const selections = [
    { resource: resource("openrouter", "a"), score: 100, reasons: [] },
    { resource: resource("openrouter", "b"), score: 99, reasons: [] },
    { resource: resource("ollama", "c", "local"), score: 98, reasons: [] },
    { resource: resource("gemini", "d"), score: 97, reasons: [] },
  ];
  const selected = selectDiverseEnsembleCandidates(selections, 3);
  assert.deepEqual(selected.map((item) => item.resource.provider), ["openrouter", "ollama", "gemini"]);
});

test("judge parser accepts strict JSON and rejects malformed judge output", () => {
  const parsed = parseAiEnsembleJudge('{"accepted":true,"score":92,"failures":[],"warnings":["minor"],"evidence":["canon retained"]}');
  assert.equal(parsed.accepted, true);
  assert.equal(parsed.score, 92);
  assert.deepEqual(parsed.evidence, ["canon retained"]);
  assert.throws(() => parseAiEnsembleJudge("not json"), /no JSON object/i);
});

test("ensemble fans candidates out concurrently, synthesizes, and requires both anti-drift judges", async () => {
  const previousSpend = process.env.AI_SPEND_POLICY;
  process.env.AI_SPEND_POLICY = "no-paid-tokens";
  let activeCandidates = 0;
  let maxActiveCandidates = 0;
  const calls = [];
  const generate = async (input) => {
    calls.push({ task: input.task, system: input.system, preferProvider: input.preferProvider, preferModel: input.preferModel });
    if (input.system.includes("ENSEMBLE ROLE:")) {
      activeCandidates += 1;
      maxActiveCandidates = Math.max(maxActiveCandidates, activeCandidates);
      await new Promise((resolve) => setTimeout(resolve, 25));
      activeCandidates -= 1;
      const provider = input.preferProvider;
      const model = input.preferModel;
      return {
        provider,
        model,
        text: `Mara opened the archive door with care. She kept her promise in mind and waited for her partner before stepping through. Candidate from ${provider}.`,
        quality: quality(92),
      };
    }
    if (input.system.includes("ENSEMBLE SYNTHESIZER:")) {
      return {
        provider: "openrouter",
        model: "synth",
        text: "Mara eased the archive door open, then stopped at the threshold. Her promise still mattered: she would not cross it alone. She listened for her partner's steps before moving forward.",
        quality: quality(96),
      };
    }
    if (input.system.includes("INDEPENDENT ANTI-DRIFT JUDGE.")) {
      return {
        provider: input.preferProvider || "ollama",
        model: input.preferModel || "judge",
        text: JSON.stringify({ accepted: true, score: 94, failures: [], warnings: [], evidence: ["Promise and threshold intent preserved."] }),
        quality: quality(95),
      };
    }
    throw new Error("Unexpected mock generation call");
  };
  try {
    const result = await runAiTextEnsemble(request(), {
      generate,
      options: options(),
      resources: [resource("openrouter", "free-a"), resource("ollama", "local-b", "local"), resource("gemini", "free-c")],
    });
    assert.equal(result.accepted, true);
    assert.equal(result.mode, "parallel");
    assert.equal(result.workers.length, 3);
    assert.equal(result.judges.length, 2);
    assert.ok(maxActiveCandidates >= 2, "candidate model calls should overlap instead of running sequentially");
    assert.match(result.finalText, /promise still mattered/i);
    assert.equal(calls.filter((call) => call.system.includes("ENSEMBLE SYNTHESIZER:")).length, 1);
  } finally {
    if (previousSpend === undefined) delete process.env.AI_SPEND_POLICY;
    else process.env.AI_SPEND_POLICY = previousSpend;
  }
});

test("fallbacks to the same actual model are deduplicated and never reported as fake diversity", async () => {
  const previousSpend = process.env.AI_SPEND_POLICY;
  process.env.AI_SPEND_POLICY = "no-paid-tokens";
  const generate = async (input) => {
    if (input.system.includes("ENSEMBLE ROLE:")) {
      return { provider: "ollama", model: "one-real-model", text: "Mara stopped at the threshold and kept her promise.", quality: quality(90) };
    }
    if (input.system.includes("INDEPENDENT ANTI-DRIFT JUDGE.")) {
      return { provider: "ollama", model: "one-real-model", text: JSON.stringify({ accepted: true, score: 90, failures: [], warnings: [], evidence: [] }), quality: quality(90) };
    }
    throw new Error("Synthesis should not run when all fallbacks collapse to one actual model.");
  };
  try {
    const result = await runAiTextEnsemble(request(), {
      generate,
      options: options(),
      resources: [resource("openrouter", "a"), resource("ollama", "b", "local"), resource("gemini", "c")],
    });
    assert.equal(result.mode, "single");
    assert.equal(result.workers.length, 1);
    assert.deepEqual(result.uniqueModelsUsed, ["ollama/one-real-model"]);
    assert.equal(result.synthesis, undefined);
  } finally {
    if (previousSpend === undefined) delete process.env.AI_SPEND_POLICY;
    else process.env.AI_SPEND_POLICY = previousSpend;
  }
});

test("a failed anti-drift judge blocks the ensemble even when candidate models score highly", async () => {
  const previousSpend = process.env.AI_SPEND_POLICY;
  process.env.AI_SPEND_POLICY = "no-paid-tokens";
  const generate = async (input) => {
    if (input.system.includes("ENSEMBLE ROLE:")) return { provider: input.preferProvider, model: input.preferModel, text: "Mara crossed the threshold alone even though the promise had never existed.", quality: quality(99) };
    if (input.system.includes("ENSEMBLE SYNTHESIZER:")) return { provider: "openrouter", model: "synth", text: "Mara crossed the threshold alone even though the promise had never existed.", quality: quality(99) };
    if (input.system.includes("INDEPENDENT ANTI-DRIFT JUDGE.")) {
      const continuity = input.task === "continuity";
      return {
        provider: "ollama",
        model: "judge",
        text: JSON.stringify(continuity
          ? { accepted: false, score: 25, failures: ["Contradicts the supplied promise."], warnings: [], evidence: ["Source says she promised not to enter alone."] }
          : { accepted: true, score: 90, failures: [], warnings: [], evidence: [] }),
        quality: quality(95),
      };
    }
    throw new Error("Unexpected call");
  };
  try {
    const result = await runAiTextEnsemble(request(), {
      generate,
      options: options(),
      resources: [resource("openrouter", "a"), resource("ollama", "b", "local")],
    });
    assert.equal(result.accepted, false);
    assert.match(result.blockedReasons.join(" "), /continuity anti-drift gate rejected/i);
  } finally {
    if (previousSpend === undefined) delete process.env.AI_SPEND_POLICY;
    else process.env.AI_SPEND_POLICY = previousSpend;
  }
});
