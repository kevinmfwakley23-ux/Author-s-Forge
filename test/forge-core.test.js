const assert = require("node:assert/strict");
const test = require("node:test");
const { createForgeCore, FORGE_CORE_FORMAT_VERSION } = require("../.forge-build/application/forge-core.js");
const { AiModelBroker } = require("../.forge-build/application/ai-model-broker.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");

function projectStore() {
  const projects = new Map();
  return {
    async create(project) { if (projects.has(project.metadata.id)) throw new Error("duplicate"); projects.set(project.metadata.id, project); },
    async load(id) { return projects.get(id) ?? null; },
    async save(project) { projects.set(project.metadata.id, project); },
    async exists(id) { return projects.has(id); },
  };
}

function project() {
  return { formatVersion: 4, metadata: { id: "project-1", title: "Core Test", createdAt: "2026-08-30T00:00:00.000Z", updatedAt: "2026-08-30T00:00:00.000Z", status: "active" }, memories: [] };
}

function configuredCore() {
  const core = createForgeCore({ projectStore: projectStore() });
  core.registerAiModels([{ provider: "test-provider", model: "test-model", configured: true, healthy: true, capabilities: { contextWindow: 128000, maxOutputTokens: 16000, creativeWriting: true, instructionFollowing: true } }]);
  return core;
}

test("Forge Core owns one shared memory store and AI broker", () => {
  const core = createForgeCore();
  assert.ok(core.memory instanceof ProjectMemoryStore);
  assert.ok(core.ai instanceof AiModelBroker);
  assert.equal(core.readiness().formatVersion, FORGE_CORE_FORMAT_VERSION);
  assert.equal(core.readiness().ready, false);
  assert.equal(core.readiness().aiConfigured, false);
  assert.equal(core.readiness().aiOperational, false);
  assert.equal(core.readiness().projectStoreAvailable, false);
});

test("Forge Core becomes ready only after durable project storage and an operational AI resource are present", () => {
  const readiness = configuredCore().readiness("2026-09-06T00:00:00.000Z");
  assert.equal(readiness.ready, true);
  assert.equal(readiness.aiConfigured, true);
  assert.equal(readiness.aiOperational, true);
  assert.equal(readiness.projectStoreAvailable, true);
  assert.equal(readiness.modelCount, 1);
  assert.equal(readiness.operationalModelCount, 1);
});

test("Forge Core never reports ready when every configured model is unhealthy or cooling down", () => {
  const core = createForgeCore({ projectStore: projectStore() });
  core.registerAiModels([
    { provider: "test", model: "unhealthy", configured: true, healthy: false, capabilities: {} },
    { provider: "test", model: "cooldown", configured: true, healthy: true, cooldownUntil: "2026-09-06T02:00:00.000Z", capabilities: {} },
  ]);
  const readiness = core.readiness("2026-09-06T01:00:00.000Z");
  assert.equal(readiness.aiConfigured, true);
  assert.equal(readiness.modelCount, 2);
  assert.equal(readiness.aiOperational, false);
  assert.equal(readiness.operationalModelCount, 0);
  assert.equal(readiness.ready, false);

  const recovered = core.readiness("2026-09-06T03:00:00.000Z");
  assert.equal(recovered.aiOperational, true);
  assert.equal(recovered.operationalModelCount, 1);
  assert.equal(recovered.ready, true);
});

test("Forge Core injects existing infrastructure instead of duplicating it", () => {
  const memory = new ProjectMemoryStore(); const broker = new AiModelBroker(); const store = projectStore();
  const core = createForgeCore({ memoryStore: memory, modelBroker: broker, projectStore: store });
  assert.strictEqual(core.memory, memory); assert.strictEqual(core.ai, broker); assert.strictEqual(core.projectStore, store);
});

test("Forge Core exposes shared durable project persistence through its port", async () => {
  const core = createForgeCore({ projectStore: projectStore() }); const state = project();
  await core.createProject(state); assert.equal(await core.projectExists("project-1"), true); assert.deepEqual(await core.loadProject("project-1"), state);
  await core.saveProject({ ...state, metadata: { ...state.metadata, title: "Updated" } }); assert.equal((await core.loadProject("project-1")).metadata.title, "Updated");
});

test("Forge Core refuses durable project operations when no store is configured", async () => { await assert.rejects(() => createForgeCore().loadProject("project-1"), /durable project store is not configured/); });

test("Forge Core exposes shared AI registration and durable memory snapshot boundaries", () => {
  const core = createForgeCore(); core.registerAiModels([{ provider: "test-provider", model: "test-model", configured: true, healthy: true, capabilities: { contextWindow: 128000, maxOutputTokens: 16000, creativeWriting: true, instructionFollowing: true } }]);
  const snapshot = core.snapshotMemory("project-1"); const restored = createForgeCore(); restored.restoreMemory(snapshot);
  assert.equal(core.readiness().modelCount, 1); assert.equal(snapshot.projectId, "project-1"); assert.deepEqual(restored.memory.list(), []);
});

test("Forge Core durable snapshot captures project state for restart recovery", async () => {
  const core = createForgeCore({ projectStore: projectStore() }); await core.createProject(project()); const snapshot = await core.snapshotDurable("project-1");
  assert.equal(snapshot.formatVersion, FORGE_CORE_FORMAT_VERSION); assert.equal(snapshot.projectId, "project-1"); assert.equal(snapshot.project.metadata.title, "Core Test"); assert.equal(snapshot.memory.projectId, "project-1");
});

test("Forge Core durable restore writes project and restores shared memory and routing state", async () => {
  const source = configuredCore(); await source.createProject(project()); const snapshot = await source.snapshotDurable("project-1");
  const target = createForgeCore({ projectStore: projectStore() }); await target.restoreDurable(snapshot);
  assert.deepEqual(await target.loadProject("project-1"), project()); assert.deepEqual(target.memory.list(), []); assert.deepEqual(target.routing.createSnapshot(), snapshot.routing);
});

test("Forge Core durable restore rejects a snapshot whose project identity does not match", async () => {
  const source = configuredCore(); await source.createProject(project()); const snapshot = await source.snapshotDurable("project-1");
  const target = createForgeCore({ projectStore: projectStore() }); await assert.rejects(() => target.restoreDurable({ ...snapshot, projectId: "other-project" }), /project identity mismatch/);
});
