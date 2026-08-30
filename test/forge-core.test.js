const assert = require("node:assert/strict");
const test = require("node:test");
const { createForgeCore, FORGE_CORE_FORMAT_VERSION } = require("../.forge-build/application/forge-core.js");
const { AiModelBroker } = require("../.forge-build/application/ai-model-broker.js");
const { ProjectMemoryStore } = require("../.forge-build/application/project-memory-store.js");

test("Forge Core owns one shared memory store and AI broker", () => {
  const core = createForgeCore();
  assert.ok(core.memory instanceof ProjectMemoryStore);
  assert.ok(core.ai instanceof AiModelBroker);
  assert.equal(core.readiness().formatVersion, FORGE_CORE_FORMAT_VERSION);
  assert.equal(core.readiness().ready, false);
  assert.equal(core.readiness().aiConfigured, false);
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
  const core = createForgeCore({ memoryStore: memory, modelBroker: broker });
  assert.strictEqual(core.memory, memory);
  assert.strictEqual(core.ai, broker);
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
