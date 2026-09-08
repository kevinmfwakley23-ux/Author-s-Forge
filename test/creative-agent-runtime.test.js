const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { FileProjectStore } = require("../dist/infrastructure/file-project-store.js");
const { createProject, withProjectStudioWorkspace } = require("../dist/domain/project.js");
const {
  createStudioWorkspace,
  createWorkspaceBook,
  addWorkspaceBook,
  addWorkspaceChapter,
  addWorkspaceScene,
  saveSceneContent,
} = require("../dist/domain/studio-workspace.js");
const {
  CreativeAgentRuntime,
  CreativeAgentRunStore,
} = require("../dist/application/creative-agent-runtime.js");

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "forge-agent-runtime-v4-"));
  const projectRoot = join(root, "projects-data");
  const runRoot = join(root, "run-data");
  const store = new FileProjectStore(projectRoot);
  let workspace = addWorkspaceBook(
    createStudioWorkspace(),
    createWorkspaceBook({ id: "book-1", title: "Runtime Book", kind: "novel", description: "Agent runtime proof" }),
  );
  workspace = addWorkspaceChapter(workspace, "book-1", { id: "chapter-1", number: 1, title: "Runtime Chapter" });
  workspace = addWorkspaceScene(workspace, "book-1", "chapter-1", { id: "scene-1", number: 1, title: "Runtime Scene" });
  workspace = saveSceneContent(workspace, "book-1", "chapter-1", "scene-1", "The existing scene gives the editorial tool real manuscript text to analyze.");
  const project = withProjectStudioWorkspace(createProject({ id: "agent-runtime-v4", title: "Agent Runtime V4" }), workspace);
  await store.create(project);
  try {
    await run({ store, runStore: new CreativeAgentRunStore(runRoot) });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function clock() {
  let tick = 0;
  const start = Date.parse("2026-09-07T12:00:00.000Z");
  return () => new Date(start + tick++ * 1000).toISOString();
}

test("Creative Agent Runtime V4 iterates tool -> observation -> replan and persists evidence", async () => {
  await fixture(async ({ store, runStore }) => {
    const eligibleSnapshots = [];
    const executions = [];
    const decide = async (context) => {
      eligibleSnapshots.push(context.eligibleTools.map((tool) => tool.id));
      if (context.observations.length === 0) {
        return { decision: { action: "tool", toolId: "project.context", reason: "Ground the next decision in current project truth." }, provider: "ollama", model: "fixture-controller" };
      }
      if (context.observations.length === 1) {
        assert.equal(context.observations[0].toolId, "project.context");
        return { decision: { action: "tool", toolId: "editing.analyze", reason: "Inspect the real scene text after grounding context." }, provider: "ollama", model: "fixture-controller" };
      }
      assert.deepEqual(context.observations.map((item) => item.toolId), ["project.context", "editing.analyze"]);
      return { decision: { action: "finish", summary: "The approved read-only mission is complete after grounded context and editorial analysis." }, provider: "ollama", model: "fixture-controller" };
    };
    const execute = async (execution) => {
      executions.push(execution);
      return { ok: true, toolId: execution.tool.id, request: execution.body };
    };
    const runtime = new CreativeAgentRuntime(store, { runStore, decide, execute, now: clock() });
    const result = await runtime.run("agent-runtime-v4", {
      goal: "Ground the project and analyze this scene, then stop.",
      bookId: "book-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      approvedToolIds: ["memory.record-working"],
      maxSteps: 5,
      runId: "iterative-proof",
    });

    assert.equal(result.status, "completed");
    assert.deepEqual(result.observations.map((item) => item.toolId), ["project.context", "editing.analyze"]);
    assert.deepEqual(result.decisions.map((item) => item.action), ["tool", "tool", "finish"]);
    assert.equal(executions.length, 2);
    assert.equal(executions[1].body.text.includes("existing scene"), true);

    assert.equal(eligibleSnapshots[0].includes("project.context"), true);
    assert.equal(eligibleSnapshots[0].includes("editing.analyze"), true);
    assert.equal(eligibleSnapshots[0].includes("writing.propose"), false, "unapproved proposal tool must be invisible to the model");
    assert.equal(eligibleSnapshots[0].includes("research.live"), false, "unapproved state-changing research tool must be invisible to the model");
    assert.equal(eligibleSnapshots[0].includes("memory.record-working"), false, "evidence memory is unavailable before a real observation exists");
    assert.equal(eligibleSnapshots[1].includes("memory.record-working"), true, "explicitly approved evidence memory becomes eligible after execution evidence exists");

    const durable = await runtime.get("agent-runtime-v4", "iterative-proof");
    assert.deepEqual(durable, result);
  });
});

test("Creative Agent Runtime V4 exposes consequential tools only after explicit run approval", async () => {
  await fixture(async ({ store, runStore }) => {
    let eligible = [];
    const runtime = new CreativeAgentRuntime(store, {
      runStore,
      now: clock(),
      decide: async (context) => {
        eligible = context.eligibleTools.map((tool) => tool.id);
        return { decision: { action: "finish", summary: "Approval visibility inspection complete." } };
      },
      execute: async () => { throw new Error("No tool should execute in approval visibility test."); },
    });
    const result = await runtime.run("agent-runtime-v4", {
      goal: "Inspect which tools are eligible.",
      bookId: "book-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      approvedToolIds: ["research.live"],
      runId: "approval-proof",
    });
    assert.equal(result.status, "completed");
    assert.equal(eligible.includes("research.live"), true);
    assert.equal(eligible.includes("writing.propose"), false);
    assert.equal(eligible.includes("production.export"), false);
  });
});

test("Creative Agent Runtime V4 stops at the configured hard mission step limit", async () => {
  await fixture(async ({ store, runStore }) => {
    const runtime = new CreativeAgentRuntime(store, {
      runStore,
      now: clock(),
      decide: async (context) => ({
        decision: { action: "tool", toolId: context.eligibleTools[0].id, reason: "Execute one safe eligible operation for the step-limit proof." },
      }),
      execute: async (execution) => ({ ok: true, toolId: execution.tool.id }),
    });
    const result = await runtime.run("agent-runtime-v4", {
      goal: "Prove the runtime cannot run forever.",
      bookId: "book-1",
      chapterId: "chapter-1",
      sceneId: "scene-1",
      maxSteps: 1,
      runId: "limit-proof",
    });
    assert.equal(result.status, "max-steps");
    assert.equal(result.observations.length, 1);
    assert.match(result.finalSummary, /limit of 1 executed steps/i);
  });
});
