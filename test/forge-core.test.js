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
  return {
    formatVersion: 4,
    metadata: { id: "project-1", title: "Core Test", createdAt: "2026-08-30T00:00:00.000Z", updatedAt: "2026-08-30T00:00:00.000Z", status: "active" },
    memories: [],
  };
}

test("Forge Core owns one shared memory store and AI broker", () => {
  const core = createForgeCore();
  assert.ok(core.memory instanceof ProjectMemoryStore);
  assert.ok(core.ai instanceof AiModelBroker);
  assert.equal(core.readiness().formatVersion, FORGE_CORE_FORMAT_VERSION);
  assert.equal(core.readiness().ready, false);
  assert.equal(core.readiness().aiConfigured, false);
  assert.equal(core.readiness().projectStoreAvailable, false);
});

test("Forge Core becomes ready only after a real configured AI resource is registered", () => {
  const core = createForgeCore();
  core.registerAiModels([{
    provider: "test-provider",
    model: "test-model",
    configured: true,
    healthy: true,
    capabilities: { contextWindow: 128000, maxOutputTokens: 16000, creativeWriting: true, instructionFollowing: true },
  }]);
  const readiness = core.readiness();
  assert.equal(readiness.ready, true);
  assert.equal(readiness.aiConfigured, true);
  assert.equal(readiness.modelCount, 1);
});

test("Forge Core injects existing infrastructure instead of duplicating it", () => {
  const memory = new ProjectMemoryStore();
  const broker = new AiModelBroker();
  const store = projectStore();
  const core = createForgeCore({ memoryStore: memory, modelBroker: broker, projectStore: store });
  assert.strictEqual(core.memory, memory);
  assert.strictEqual(core.ai, broker);
  assert.strictEqual(core.projectStore, store);
});

test("Forge Core exposes shared durable project persistence through its port", async () => {
  const store = projectStore();
  const core = createForgeCore({ projectStore: store });
  const state = project();
  await core.createProject(state);
  assert.equal(await core.projectExists("project-1"), true);
  assert.deepEqual(await core.loadProject("project-1"), state);
  const updated = { ...state, metadata: { ...state.metadata, title: "Updated" } };
  await core.saveProject(updated);
  assert.equal((await core.loadProject("project-1")).metadata.title, "Updated");
});

test("Forge Core refuses durable project operations when no store is configured", async () => {
  const core = createForgeCore();
  await assert.rejects(() => core.loadProject("project-1"), /durable project store is not configured/);
});

test("Forge Core exposes shared AI registration and durable memory snapshot boundaries", () => {
  const core = createForgeCore();
  core.registerAiModels([{
    provider: "test-provider",
    model: "test-model",
    configured: true,
    healthy: true,
    capabilities: { contextWindow: 128000, maxOutputTokens: 16000, creativeWriting: true, instructionFollowing: true },
  }]);
  assert.equal(core.readiness().modelCount, 1);
  const snapshot = core.snapshotMemory("project-1");
  assert.equal(snapshot.projectId, "project-1");
  const restored = createForgeCore();
  restored.restoreMemory(snapshot);
  assert.deepEqual(restored.memory.list(), []);
});
