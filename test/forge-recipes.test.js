"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { Readable } = require("node:stream");

const { createProject } = require("../dist/domain/project");
const { createMemoryRecord } = require("../dist/domain/memory");
const { createForgeRecipe } = require("../dist/domain/forge-recipes");
const { FileProjectStore } = require("../dist/infrastructure/file-project-store");
const { FileAiProposalStore } = require("../dist/infrastructure/file-ai-proposal-store");
const { FileForgeRecipeStore } = require("../dist/infrastructure/file-forge-recipe-store");
const { createStudioForgeRecipeRoutes } = require("../dist/application/studio-forge-recipe-routes");

function request(method, payload) {
  const text = payload === undefined ? "" : JSON.stringify(payload);
  const req = Readable.from(text ? [text] : []);
  req.method = method;
  return req;
}

function responseCapture() {
  let status = 0;
  let headers = {};
  let body = "";
  return {
    res: {
      writeHead(code, nextHeaders) { status = code; headers = nextHeaders || {}; },
      end(value) { body += value ? String(value) : ""; },
    },
    result() { return { status, headers, body, json: body ? JSON.parse(body) : undefined }; },
  };
}

async function call(handler, method, url, projectId, payload) {
  const capture = responseCapture();
  const handled = await handler(request(method, payload), capture.res, new URL(url, "http://localhost"), projectId);
  assert.equal(handled, true);
  return capture.result();
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "forge-recipes-"));
  const projects = new FileProjectStore(root);
  const projectId = "recipe-project";
  const project = createProject({ id: projectId, title: "Recipe Test" });
  project.memories.push?.();
  await projects.create({
    ...project,
    memories: [createMemoryRecord({
      id: "memory-voice", projectId, class: "style-memory", authority: "authoritative",
      summary: "Author voice", content: "Use warm, precise prose.",
      provenance: [{ kind: "author", reference: "test", recordedAt: "2026-09-04T00:00:00.000Z" }],
      relevanceTags: ["voice"], now: "2026-09-04T00:00:00.000Z",
    })],
  });
  const recipeStore = new FileForgeRecipeStore(join(root, "forge-recipes.json"));
  const proposalPath = join(root, "ai-proposals.json");
  const proposalStore = new FileAiProposalStore(proposalPath);
  return { root, projects, projectId, recipeStore, proposalStore, proposalPath };
}

test("Forge Recipe contract rejects unsafe or ambiguous workflow definitions", () => {
  assert.throws(() => createForgeRecipe({
    id: "bad", projectId: "p", name: "Bad", stages: [],
  }), /between 1 and 8 stages/);
  assert.throws(() => createForgeRecipe({
    id: "bad", projectId: "p", name: "Bad", stages: [{ id: "s", name: "S", instruction: "Do work", task: "writing", usePreviousOutput: false, temperature: 9 }],
  }), /temperature/);
});

test("multi-stage Forge Recipe chains output, preserves provenance, and creates pending author proposal", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  const calls = [];
  const generator = async (input) => {
    calls.push(input);
    const n = calls.length;
    return {
      provider: n === 1 ? "ollama" : "openrouter",
      model: n === 1 ? "local-model" : "creative-model",
      text: n === 1 ? "Stage one insight" : "Final polished result",
      requestId: `req-${n}`,
      usage: { inputTokens: 10 * n, outputTokens: 20 * n, totalTokens: 30 * n, source: "provider" },
      cacheHit: false,
      attempts: [{ provider: n === 1 ? "ollama" : "openrouter", model: n === 1 ? "local-model" : "creative-model", success: true, latencyMs: 5 }],
    };
  };
  const handler = createStudioForgeRecipeRoutes(f.projects, f.recipeStore, f.proposalStore, generator);
  const created = await call(handler, "POST", `/api/projects/${f.projectId}/recipes`, f.projectId, {
    id: "two-stage",
    name: "Two Stage Polish",
    description: "Analyze then polish.",
    memoryClasses: ["style-memory"],
    relevanceTags: ["voice"],
    stages: [
      { id: "analyze", name: "Analyze", instruction: "Find the strongest idea.", task: "editing", usePreviousOutput: false, preferProvider: "ollama" },
      { id: "polish", name: "Polish", instruction: "Turn the analysis into final prose.", task: "writing", usePreviousOutput: true, preferProvider: "openrouter", preferModel: "creative-model" },
    ],
  });
  assert.equal(created.status, 201);
  const run = await call(handler, "POST", `/api/projects/${f.projectId}/recipes/two-stage/run`, f.projectId, { input: "Raw author idea" });
  assert.equal(run.status, 201);
  assert.equal(calls.length, 2);
  assert.match(calls[1].user, /Stage one insight/);
  assert.equal(calls[0].preferProvider, "ollama");
  assert.equal(calls[1].preferProvider, "openrouter");
  assert.equal(calls[1].preferModel, "creative-model");
  assert.equal(run.json.run.status, "completed");
  assert.equal(run.json.run.stages[0].provider, "ollama");
  assert.equal(run.json.run.stages[1].provider, "openrouter");
  assert.deepEqual(run.json.run.sourceMemoryIds, ["memory-voice"]);
  assert.equal(run.json.proposal.status, "pending");
  assert.equal(run.json.proposal.proposedContent, "Final polished result");
  assert.match(run.json.proposal.rationale, /revision [a-f0-9]{64}/);

  const history = await call(handler, "GET", `/api/projects/${f.projectId}/recipe-runs?recipeId=two-stage`, f.projectId);
  assert.equal(history.json.runs.length, 1);
  assert.equal(history.json.runs[0].proposalId, run.json.proposal.id);
});

test("failed Forge Recipe records truthful durable failure and creates no proposal", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  let count = 0;
  const handler = createStudioForgeRecipeRoutes(f.projects, f.recipeStore, f.proposalStore, async () => {
    count += 1;
    if (count === 1) return { provider: "ollama", model: "local", text: "intermediate" };
    throw new Error("provider offline");
  });
  await call(handler, "POST", `/api/projects/${f.projectId}/recipes`, f.projectId, {
    id: "failure", name: "Failure Test", stages: [
      { id: "one", name: "One", instruction: "First", task: "writing", usePreviousOutput: false },
      { id: "two", name: "Two", instruction: "Second", task: "writing", usePreviousOutput: true },
    ],
  });
  await assert.rejects(
    () => call(handler, "POST", `/api/projects/${f.projectId}/recipes/failure/run`, f.projectId, { input: "test" }),
    /failed truthfully after 1 completed stage.*provider offline/i,
  );
  const runs = await f.recipeStore.listRuns(f.projectId, "failure");
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, "failed");
  assert.equal(runs[0].stages.length, 1);
  assert.match(runs[0].error, /provider offline/);
  const ledger = await f.proposalStore.load();
  assert.equal(ledger.list(f.projectId).length, 0);
});

test("same proposal file uses one shared in-process ledger across route modules", async (t) => {
  const f = await fixture();
  t.after(() => rm(f.root, { recursive: true, force: true }));
  const first = new FileAiProposalStore(f.proposalPath);
  const second = new FileAiProposalStore(f.proposalPath);
  const a = await first.load();
  const b = await second.load();
  assert.equal(a, b);
  a.propose({ id: "shared-proposal", projectId: f.projectId, kind: "creative-alternative", title: "Shared", rationale: "test", proposedContent: "candidate", sourceMemoryIds: [] });
  await first.save();
  assert.equal(b.get("shared-proposal").proposedContent, "candidate");
  b.review("shared-proposal", "accepted", "author");
  await second.save();
  assert.equal(a.get("shared-proposal").status, "accepted");
});
