"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

const read = (path) => readFileSync(path, "utf8");

test("Forge Recipes client is valid JavaScript and loaded by both installed shells", () => {
  const recipes = read("public/forge-recipes.js");
  const pwa = read("public/forge-pwa.js");
  const localWorker = read("public/sw.js");
  const hostedWorker = read("public/sw-hosted.js");
  assert.doesNotThrow(() => new vm.Script(recipes, { filename: "forge-recipes.js" }));
  assert.match(pwa, /loadExtension\("forge-recipes","\/forge-recipes\.js"\)/);
  assert.match(localWorker, /"\/forge-recipes\.js"/);
  assert.match(hostedWorker, /"\/forge-recipes\.js"/);
  assert.match(localWorker, /authors-forge-shell-v17/);
  assert.match(hostedWorker, /authors-forge-hosted-shell-v2/);
});

test("Forge Recipes client exposes no-code stages, provider/model control, durable history, and separate review/apply", () => {
  const recipes = read("public/forge-recipes.js");
  for (const contract of [
    "Build your own reusable AI tools",
    "data-stage-provider",
    "data-stage-model",
    "Use previous stage output",
    "/recipe-runs",
    "data-recipe-review",
    "data-recipe-apply",
    "nothing was applied automatically",
  ]) assert.match(recipes, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.match(recipes, /min=\"128\" max=\"32000\"/);
  assert.match(recipes, /Run \\"\$\{recipe\.name\}\\"\? This will make \$\{recipe\.stages\.length\} real AI request/);
});

test("native shell never mislabels WebView CORS as server-offline state", () => {
  const native = read("native-shell/app.js");
  assert.doesNotThrow(() => new vm.Script(native, { filename: "native-shell/app.js" }));
  assert.doesNotMatch(native, /fetch\(healthUrl/);
  assert.match(native, /WebView CORS/);
  assert.match(native, /window\.location\.assign\(target\.href\)/);
  assert.match(native, /Remote Forge connections must use HTTPS/);
});

test("platform contract does not falsely claim native PS5 or mandatory Termux", () => {
  const matrix = read("docs/PLATFORM_EXECUTION_MATRIX.md");
  assert.match(matrix, /without requiring Termux/i);
  assert.match(matrix, /No native PS5 package is claimed/i);
  assert.match(matrix, /Windows 10\/11/);
  assert.match(matrix, /macOS/);
  assert.match(matrix, /Chromebook/);
  assert.match(matrix, /Android phone\/tablet/);
  assert.match(matrix, /iPhone\/iPad/);
});
