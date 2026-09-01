const test = require("node:test");
const assert = require("node:assert/strict");
const { createForgeCore, FORGE_CORE_FORMAT_VERSION } = require("../.forge-build/application/forge-core.js");
const { createProject, withProjectMemories } = require("../.forge-build/domain/project.js");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");

function memory(id, projectId, content) {
  return createMemoryRecord({
    id,
    projectId,
    class: "story-canon",
    authority: "authoritative",
    summary: id,
    content,
    provenance: [{ kind: "author", reference: id, recordedAt: "2026-01-01T00:00:00.000Z" }],
    now: "2026-01-01T00:00:00.000Z",
  });
}

function memoryProject(id, memoryId, content) {
  const project = createProject({ id, title: id, now: "2026-01-01T00:00:00.000Z" });
  return withProjectMemories(project, [memory(memoryId, id, content)], "2026-01-01T00:00:01.000Z");
}

function projectStore(initial = []) {
  const projects = new Map(initial.map((project) => [project.metadata.id, project]));
  return {
    async create(project) { if (projects.has(project.metadata.id)) throw new Error("duplicate"); projects.set(project.metadata.id, project); },
    async load(id) { return projects.get(id) ?? null; },
    async save(project) { projects.set(project.metadata.id, project); },
    async exists(id) { return projects.has(id); },
  };
}

test("project create/load/save synchronize durable memories into the shared Project Brain without deleting other projects", async () => {
  const p1 = memoryProject("p1", "p1-canon", "Project one original canon.");
  const p2 = memoryProject("p2", "p2-canon", "Project two canon.");
  const store = projectStore([p1, p2]);
  const core = createForgeCore({ projectStore: store });

  await core.loadProject("p1");
  await core.loadProject("p2");
  assert.equal(core.memory.get("p1-canon").content, "Project one original canon.");
  assert.equal(core.memory.get("p2-canon").content, "Project two canon.");

  const updatedP1 = withProjectMemories(p1, [memory("p1-new", "p1", "Project one updated canon.")], "2026-01-02T00:00:00.000Z");
  await core.saveProject(updatedP1);
  assert.equal(core.memory.get("p1-canon"), undefined);
  assert.equal(core.memory.get("p1-new").content, "Project one updated canon.");
  assert.equal(core.memory.get("p2-canon").content, "Project two canon.");

  const p3 = memoryProject("p3", "p3-canon", "Project three canon.");
  await core.createProject(p3);
  assert.equal(core.memory.get("p3-canon").content, "Project three canon.");
});

test("durable snapshot refreshes Project Brain from the persisted project before capturing memory", async () => {
  const project = memoryProject("p1", "durable-canon", "Durable canon wins.");
  const core = createForgeCore({ projectStore: projectStore([project]) });
  core.memory.register(memory("stale-cached", "p1", "Stale in-process memory."));

  const snapshot = await core.snapshotDurable("p1");

  assert.deepEqual(snapshot.memory.memories.map((item) => item.id), ["durable-canon"]);
  assert.deepEqual(core.memory.query({ projectId: "p1" }).map((item) => item.id), ["durable-canon"]);
});

test("durable restore trusts project package memory over a stale transient memory mirror while preserving other loaded projects", async () => {
  const restoredProject = memoryProject("p1", "project-canon", "Project package canon.");
  const target = createForgeCore({ projectStore: projectStore() });
  target.memory.register(memory("p2-canon", "p2", "Other project survives."));

  await target.restoreDurable({
    formatVersion: FORGE_CORE_FORMAT_VERSION,
    projectId: "p1",
    project: restoredProject,
    memory: { formatVersion: 1, projectId: "p1", memories: [] },
    routing: { formatVersion: 1, states: [] },
  });

  assert.equal((await target.loadProject("p1")).memories[0].id, "project-canon");
  assert.equal(target.memory.get("project-canon").content, "Project package canon.");
  assert.equal(target.memory.get("p2-canon").content, "Other project survives.");
});
