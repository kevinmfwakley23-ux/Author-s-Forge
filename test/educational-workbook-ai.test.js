const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createMemoryRecord } = require("../dist/domain/memory.js");
const { ProjectMemoryStore } = require("../dist/application/project-memory-store.js");
const { EducationalWorkbookIntelligenceService } = require("../dist/application/educational-workbook-intelligence.js");
const { FileEducationalWorkbookAiProposalStore } = require("../dist/infrastructure/file-educational-workbook-ai-proposal-store.js");

const NOW = "2026-09-01T12:00:00.000Z";

test("Workbook intelligence consumes Project Brain context and returns validated author-reviewable AI activities", async () => {
  const memory = new ProjectMemoryStore();
  memory.register(createMemoryRecord({
    id: "project-learning-note",
    projectId: "education-project",
    class: "project-memory",
    authority: "authoritative",
    summary: "Workbook teaching direction",
    content: "Keep multiplication practice concrete, concise, and grade appropriate.",
    provenance: [{ kind: "author", reference: "workbook-direction", recordedAt: NOW }],
    relevanceTags: ["educational-workbook", "math"],
    now: NOW,
  }));
  let captured;
  const fakeAi = async (request) => {
    captured = request;
    return {
      provider: "openai",
      model: "test-model",
      text: JSON.stringify({ activities: [
        { prompt: "Solve 6 × 7.", answer: "42", explanation: "Six groups of seven equal 42.", standards: ["LOCAL.MATH.4.MULTIPLY"], tags: ["multiplication"], points: 1 },
        { prompt: "Solve 8 × 9.", answer: "72", explanation: "Eight groups of nine equal 72.", standards: ["LOCAL.MATH.4.MULTIPLY"], tags: ["multiplication"], points: 1 },
      ] }),
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, source: "provider" },
      routing: { accountedTokens: 150, usageSource: "provider", task: "writing", mode: "economy" },
      optimization: { originalEstimatedTokens: 300, optimizedEstimatedTokens: 180, tokensSaved: 120, compressionRatio: 0.6, strategy: ["project-brain-retrieval"] },
      attempts: [{ provider: "openai", model: "test-model", success: true, latencyMs: 5 }],
    };
  };
  const intelligence = new EducationalWorkbookIntelligenceService(memory, fakeAi);
  const proposal = await intelligence.proposeActivities({
    projectId: "education-project",
    subject: "math",
    gradeBands: ["3-5"],
    kind: "math-practice",
    count: 2,
    learningObjective: "Practice single-digit multiplication facts accurately.",
    standards: ["LOCAL.MATH.4.MULTIPLY"],
    tags: ["multiplication"],
  });

  assert.equal(captured.context.projectId, "education-project");
  assert.ok(captured.context.taskMemoryClasses.includes("project-memory"));
  assert.ok(captured.context.relevanceTags.includes("educational-workbook"));
  assert.equal(captured.task, "writing");
  assert.equal(proposal.activities.length, 2);
  assert.equal(proposal.activities[0].answer, "42");
  assert.equal(proposal.ai.usage.totalTokens, 150);
  assert.equal(proposal.ai.optimization.tokensSaved, 120);
  assert.equal(memory.list("education-project").length, 1, "Generating a proposal must not mutate Project Brain or approve output.");
});

test("Workbook intelligence rejects fabricated standards and invalid answer truth", async () => {
  const memory = new ProjectMemoryStore();
  const fabricatedStandardAi = async () => ({
    provider: "openai",
    model: "test-model",
    text: JSON.stringify({ activities: [{ prompt: "Solve 3 × 4.", answer: "12", standards: ["MADE.UP.STANDARD"], tags: [], points: 1 }] }),
  });
  await assert.rejects(
    () => new EducationalWorkbookIntelligenceService(memory, fabricatedStandardAi).proposeActivities({
      projectId: "education-project",
      subject: "math",
      gradeBands: ["3-5"],
      kind: "math-practice",
      count: 1,
      learningObjective: "Multiply accurately.",
      standards: ["AUTHOR.SUPPLIED.STANDARD"],
    }),
    /omitted an author-required standards identifier/,
  );

  const invalidAnswerAi = async () => ({
    provider: "openai",
    model: "test-model",
    text: JSON.stringify({ activities: [{ prompt: "Choose the even number.", choices: ["3", "4"], answer: "5", standards: [], tags: [], points: 1 }] }),
  });
  await assert.rejects(
    () => new EducationalWorkbookIntelligenceService(memory, invalidAnswerAi).proposeActivities({
      projectId: "education-project",
      subject: "math",
      gradeBands: ["3-5"],
      kind: "multiple-choice",
      count: 1,
      learningObjective: "Identify even numbers.",
    }),
    /answer must exactly match one choice/,
  );
});

test("Workbook AI proposal store survives restart and enforces server-owned decision state", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-workbook-ai-proposals-"));
  const file = join(dir, "proposals.json");
  try {
    const proposal = {
      activities: [{
        id: "ai-math-1",
        projectId: "education-project",
        subject: "math",
        gradeBands: ["3-5"],
        kind: "math-practice",
        difficulty: "practice",
        prompt: "Solve 5 × 5.",
        answer: "25",
        standards: [],
        tags: ["multiplication"],
        points: 1,
        enabled: true,
        createdAt: NOW,
        updatedAt: NOW,
      }],
      ai: {
        provider: "openai",
        model: "test-model",
        usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30, source: "provider" },
        routing: { accountedTokens: 30, usageSource: "provider", task: "writing", mode: "economy" },
      },
    };
    const first = new FileEducationalWorkbookAiProposalStore(file);
    const stored = await first.create({ id: "proposal-1", projectId: "education-project", proposal, now: NOW });
    assert.equal(stored.status, "pending");

    const restarted = new FileEducationalWorkbookAiProposalStore(file);
    const recovered = await restarted.get("education-project", "proposal-1");
    assert.equal(recovered.status, "pending");
    assert.equal(recovered.ai.usage.totalTokens, 30);
    const approved = await restarted.decide("education-project", "proposal-1", "approved", "2026-09-01T12:05:00.000Z");
    assert.equal(approved.status, "approved");
    assert.equal((await restarted.get("other-project", "proposal-1")), undefined);
    await assert.rejects(() => restarted.decide("education-project", "proposal-1", "rejected"), /already approved/);

    const secondRestart = new FileEducationalWorkbookAiProposalStore(file);
    assert.equal((await secondRestart.get("education-project", "proposal-1")).status, "approved");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
