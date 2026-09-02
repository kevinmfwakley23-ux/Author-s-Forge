const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioLiveResearchService } = require("../.forge-build/application/studio-live-research.js");
const { createProject, withProjectMemories } = require("../.forge-build/domain/project.js");
const { createMemoryRecord } = require("../.forge-build/domain/memory.js");

const unrestricted = { formatVersion: 1, spendPolicy: "unrestricted", routingMode: "economy", providerOrder: ["openai"] };

function staticProvider(overrides = {}) {
  return {
    async research() {
      return [{ source: "National Archive", date: "2026-08-30", url: "https://archive.example/fact", claim: "A verified historical detail relevant to the manuscript.", confidence: "high", relevance: "high", ...overrides }];
    },
  };
}

async function withStore(run) {
  const dir = await mkdtemp(join(tmpdir(), "forge-live-research-"));
  const store = new FileProjectStore(dir);
  try {
    await store.create(createProject({ id: "research-project", title: "Research Project", now: "2026-09-01T18:00:00Z" }));
    await run(store);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("live research persists source-backed working memory and survives restart", async () => {
  await withStore(async (store) => {
    const service = new StudioLiveResearchService(store, () => staticProvider(), () => unrestricted);
    const result = await service.research("research-project", { question: "What happened?", researchedBecause: "Keep the setting accurate.", domain: "historical-period" });
    assert.equal(result.sourceBacked, true);
    assert.equal(result.canonEligible, false);
    assert.equal(result.authority, "working");
    assert.equal(result.record.claims.length, 1);
    const restored = await store.load("research-project");
    assert.equal(restored.memories.length, 1);
    assert.equal(restored.memories[0].class, "research-memory");
    assert.equal(restored.memories[0].authority, "working");
    assert.equal(restored.memories[0].provenance[0].reference, "https://archive.example/fact");
  });
});

test("live research reloads latest project before persistence so concurrent author work survives", async () => {
  await withStore(async (store) => {
    let providerCalled = false;
    const provider = {
      async research() {
        providerCalled = true;
        const latest = await store.load("research-project");
        const authorMemory = createMemoryRecord({
          id: "author-during-research", projectId: "research-project", class: "session-memory", authority: "working",
          summary: "Author wrote while research was running.", content: "Do not overwrite this work.", now: "2026-09-01T18:05:00Z",
        });
        await store.save(withProjectMemories(latest, [...latest.memories, authorMemory], "2026-09-01T18:05:00Z"));
        return staticProvider().research();
      },
    };
    const service = new StudioLiveResearchService(store, () => provider, () => unrestricted);
    await service.research("research-project", { question: "Check the detail", researchedBecause: "Accuracy", domain: "historical-event" });
    assert.equal(providerCalled, true);
    const restored = await store.load("research-project");
    assert.ok(restored.memories.some((item) => item.id === "author-during-research"));
    assert.ok(restored.memories.some((item) => item.class === "research-memory"));
    assert.equal(restored.memories.length, 2);
  });
});

test("provider failure never mutates durable project state", async () => {
  await withStore(async (store) => {
    const service = new StudioLiveResearchService(store, () => ({ research: async () => { throw new Error("network unavailable"); } }), () => unrestricted);
    await assert.rejects(() => service.research("research-project", { question: "Check this", researchedBecause: "Accuracy", domain: "technology" }), /network unavailable/);
    const restored = await store.load("research-project");
    assert.equal(restored.memories.length, 0);
  });
});

test("hosted research cannot bypass No Paid Tokens, budgeted mode, or a non-OpenAI pin", async () => {
  await withStore(async (store) => {
    let providerCalls = 0;
    const providerFactory = () => ({ research: async () => { providerCalls += 1; return staticProvider().research(); } });
    for (const control of [
      { ...unrestricted, spendPolicy: "no-paid-tokens" },
      { ...unrestricted, spendPolicy: "budgeted", maxEstimatedRequestCostUsd: 1 },
      { ...unrestricted, pinnedProvider: "ollama", pinnedModel: "qwen" },
    ]) {
      const service = new StudioLiveResearchService(store, providerFactory, () => control);
      await assert.rejects(() => service.research("research-project", { question: "Check this", researchedBecause: "Accuracy", domain: "technology" }), /blocked by the owner AI spend policy|requires the OpenAI web_search tool/);
    }
    assert.equal(providerCalls, 0);
    assert.equal((await store.load("research-project")).memories.length, 0);
  });
});
