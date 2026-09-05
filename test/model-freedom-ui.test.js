const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const vm = require("node:vm");

async function source(path) { return readFile(path, "utf8"); }

test("Model Freedom browser extension parses and exposes cost/model/quality controls", async () => {
  const js = await source("public/forge-model-freedom.js");
  new vm.Script(js, { filename: "forge-model-freedom.js" });
  assert.match(js, /model-options/);
  assert.match(js, /catalog\?provider=/);
  assert.match(js, /trustedNoSpendModels/);
  assert.match(js, /ensembleMaxWorkers/);
  assert.match(js, /ensembleMinQualityScore/);
  assert.match(js, /ensembleMaxTotalEstimatedCostUsd/);
  assert.match(js, /ensemble-writing/);
  assert.match(js, /Run Multi-Model Forge/);
  assert.match(js, /Anti-drift/);
  assert.match(js, /Editing Office/);
  assert.match(js, /author approval and separate Apply required/);
});

test("PWA loaders and both service workers include Model Freedom", async () => {
  const [pwa, localWorker, hostedWorker] = await Promise.all([
    source("public/forge-pwa.js"),
    source("public/sw.js"),
    source("public/sw-hosted.js"),
  ]);
  assert.match(pwa, /model-freedom/);
  assert.match(pwa, /forge-model-freedom\.js/);
  assert.match(localWorker, /forge-model-freedom\.js/);
  assert.match(hostedWorker, /forge-model-freedom\.js/);
});

test("model UI does not claim price equals quality or silently apply ensemble output", async () => {
  const js = await source("public/forge-model-freedom.js");
  assert.match(js, /Model price never bypasses/);
  assert.match(js, /No-spend trust is your explicit declaration/);
  assert.match(js, /Nothing was applied automatically/);
  assert.doesNotMatch(js, /auto[- ]?apply/i);
});
