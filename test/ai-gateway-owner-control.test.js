const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm, writeFile, mkdir } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const {
  refreshPersistedAiOwnerControl,
  constrainResourcesForOwnerPin,
} = require("../dist/infrastructure/ai-owner-control-runtime.js");

function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) if (!(key in snapshot)) delete process.env[key];
  for (const [key, value] of Object.entries(snapshot)) process.env[key] = value;
}

test("owner control accepts and enforces an exact generic gateway model pin", async () => {
  const env = { ...process.env };
  const root = await mkdtemp(join(tmpdir(), "forge-gateway-pin-"));
  try {
    process.env.FORGE_DATA_DIR = root;
    await mkdir(root, { recursive:true });
    await writeFile(join(root, "ai-runtime-control.json"), JSON.stringify({
      formatVersion:1,
      spendPolicy:"unrestricted",
      routingMode:"balanced",
      providerOrder:["gateway", "ollama", "openai"],
      pinnedProvider:"gateway",
      pinnedModel:"home::writer",
      updatedAt:"2026-09-04T18:00:00.000Z",
    }), "utf8");

    const control = refreshPersistedAiOwnerControl(process.env);
    assert.equal(control.pinnedProvider, "gateway");
    assert.equal(control.pinnedModel, "home::writer");
    assert.equal(process.env.AI_PINNED_PROVIDER, "gateway");
    assert.equal(process.env.AI_PINNED_MODEL, "home::writer");
    assert.equal(process.env.AI_PROVIDER_ORDER.split(",")[0], "gateway");

    const resources = [
      { provider:"gateway", model:"home::writer", configured:true, healthy:true, capabilities:{} },
      { provider:"gateway", model:"home::other", configured:true, healthy:true, capabilities:{} },
      { provider:"ollama", model:"local", configured:true, healthy:true, capabilities:{} },
    ];
    const pinned = constrainResourcesForOwnerPin(resources, control);
    assert.deepEqual(pinned.map((item) => `${item.provider}/${item.model}`), ["gateway/home::writer"]);
  } finally {
    await rm(root, { recursive:true, force:true });
    restoreEnv(env);
  }
});
