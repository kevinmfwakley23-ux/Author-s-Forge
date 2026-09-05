const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const vm = require("node:vm");

async function text(path) { return readFile(path, "utf8"); }

test("AI gateway browser module parses and exposes real project-scoped gateway operations without raw-secret storage", async () => {
  const source = await text("public/forge-ai-gateways.js");
  assert.doesNotThrow(() => new vm.Script(source, { filename:"forge-ai-gateways.js" }));
  assert.match(source, /const root = `\/api\/projects\/\$\{encodeURIComponent\(projectId\)\}\/ai`/);
  assert.match(source, /`\$\{root\}\/gateways`/);
  assert.match(source, /Discover & register models/);
  assert.match(source, /apiKeyEnv/);
  assert.match(source, /Raw API keys are intentionally rejected/);
  assert.match(source, /gateway\/\$\{encodedModel\}/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^)]*(?:apiKey|token|secret)/i);
});

test("PWA and both service-worker shells load/cache the gateway settings module", async () => {
  const [pwa, localSw, hostedSw] = await Promise.all([
    text("public/forge-pwa.js"),
    text("public/sw.js"),
    text("public/sw-hosted.js"),
  ]);
  assert.match(pwa, /loadExtension\("ai-gateways","\/forge-ai-gateways\.js"\)/);
  assert.match(localSw, /"\/forge-ai-gateways\.js"/);
  assert.match(hostedSw, /"\/forge-ai-gateways\.js"/);
});

test("gateway settings describe unknown billing and owner-controlled no-spend trust rather than claiming free usage", async () => {
  const source = await text("public/forge-ai-gateways.js");
  assert.match(source, /unknown billing/);
  assert.match(source, /Toggle no-spend trust/);
  assert.match(source, /Newly discovered models were registered with unknown billing/);
});
