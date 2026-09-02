const test = require("node:test");
const assert = require("node:assert/strict");
const { createProject } = require("../.forge-build/domain/project.js");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");
const { StudioArchitectureAiService } = require("../.forge-build/application/studio-architecture-ai-routes.js");

function projectFixture() {
  const project = createProject({ id: "project-1", title: "Canon-Aware Architecture", now: "2026-09-01T18:00:00.000Z" });
  const canon = createMemoryRecord({
    id: "canon-1",
    projectId: "project-1",
    class: "story-canon",
    authority: "authoritative",
    summary: "The city is isolated by winter storms.",
    content: "The story takes place in an isolated mountain city during one severe winter.",
    provenance: [{ kind: "author", reference: "author-canon", recordedAt: "2026-09-01T18:01:00.000Z" }],
    relevanceTags: ["setting", "winter"],
    now: "2026-09-01T18:01:00.000Z",
  });
  return { ...project, memories: [canon] };
}

test("Story Architecture binds provider work to durable Project Brain memory", async () => {
  const project = projectFixture();
  let captured;
  const service = new StudioArchitectureAiService(
    { load: async (id) => id === "project-1" ? project : undefined },
    async (request) => {
      captured = request;
      return { provider: "openai", model: "test-model", text: "Candidate architecture", requestId: "req-1" };
    },
  );

  const result = await service.generate({
    projectId: "project-1",
    idea: "A parent searches for the truth behind a disappearance.",
    kind: "psychological-thriller",
    targetChapters: 22,
  });

  assert.equal(result.candidate, true);
  assert.equal(result.authorApprovalRequired, true);
  assert.equal(result.contextBoundary, "project-brain");
  assert.equal(result.text, "Candidate architecture");
  assert.equal(captured.context.projectId, "project-1");
  assert.ok(captured.context.taskMemoryClasses.includes("story-canon"));
  assert.ok(captured.context.taskMemoryClasses.includes("author-memory"));
  assert.equal(captured.task, "writing");
  assert.equal(captured.requiresReasoning, undefined, "architecture must not reject capable writing models merely because reasoning metadata is unknown");
  assert.equal(captured.requiresCreativeWriting, true);
  assert.equal(captured.requiresInstructionFollowing, true);
  assert.match(captured.user, /TARGET CHAPTERS: 22/);
  assert.match(captured.user, /psychological-thriller/);
  assert.deepEqual(captured.memory.query({ projectId: "project-1", class: "story-canon" }).map((item) => item.id), ["canon-1"]);
});

test("Story Architecture validates input before provider execution", async () => {
  let calls = 0;
  const project = projectFixture();
  const service = new StudioArchitectureAiService(
    { load: async () => project },
    async () => { calls += 1; throw new Error("provider should not run"); },
  );

  await assert.rejects(() => service.generate({ projectId: "project-1", idea: "   " }), /Book idea is required/);
  await assert.rejects(() => service.generate({ projectId: "project-1", idea: "Valid idea", targetChapters: 501 }), /1 through 500/);
  assert.equal(calls, 0);
});

test("Story Architecture fails honestly for a missing project", async () => {
  let calls = 0;
  const service = new StudioArchitectureAiService(
    { load: async () => undefined },
    async () => { calls += 1; throw new Error("provider should not run"); },
  );
  await assert.rejects(() => service.generate({ projectId: "missing", idea: "Valid idea" }), /Project "missing" not found/);
  assert.equal(calls, 0);
});
