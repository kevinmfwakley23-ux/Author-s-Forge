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
  assert.match(localWorker, /authors-forge-shell-v\d+/);
  assert.match(hostedWorker, /authors-forge-hosted-shell-v\d+/);
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
    "This will make ${recipe.stages.length} real AI request",
  ]) assert.match(recipes, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.match(recipes, /min=\"128\" max=\"32000\"/);
});

test("native standalone boot reports embedded runtime failure instead of inventing remote CORS or offline state", () => {
  const native = read("native-shell/app.js");
  const assembler = read("scripts/prepare-android-embedded-runtime.js");
  assert.doesNotThrow(() => new vm.Script(native, { filename: "native-shell/app.js" }));
  assert.doesNotMatch(native, /WebView CORS|Remote Forge connections must use HTTPS|window\.location\.assign\(target\.href\)|fetch\(healthUrl/);
  assert.match(native, /__forgeNativeBootFailed/);
  assert.match(assembler, /HEALTH_URL = \"http:\/\/127\.0\.0\.1:4173\/api\/health\"/);
  assert.match(assembler, /Forge Core startup failed/);
  assert.match(assembler, /webView\.loadUrl\(STUDIO_URL\)/);
});

test("platform contract does not falsely claim native PS5 or mandatory Termux", () => {
  const matrix = read("docs/PLATFORM_EXECUTION_MATRIX.md");
  assert.match(matrix, /without requiring Termux/i);
  assert.match(matrix, /No native PS5 package is claimed/i);
  assert.match(matrix, /no direct consumer PS5 launch path is currently marked supported/i);
  assert.match(matrix, /Windows 10\/11/);
  assert.match(matrix, /macOS/);
  assert.match(matrix, /Chromebook/);
  assert.match(matrix, /Android phone\/tablet/);
  assert.match(matrix, /iPhone\/iPad/);
});

test("native Android boot opens only the embedded localhost Studio while PS5 claims remain truthful", () => {
  const shell = read("native-shell/index.html");
  const assembler = read("scripts/prepare-android-embedded-runtime.js");
  const matrix = read("docs/PLATFORM_EXECUTION_MATRIX.md");
  assert.match(shell, /No hosted address and no Termux are required/i);
  assert.doesNotMatch(shell, /forge\.example\.com|forge-url|Enter the Forge/i);
  assert.match(assembler, /STUDIO_URL = \"http:\/\/127\.0\.0\.1:4173\/\"/);
  assert.doesNotMatch(assembler, /127\.0\.0\.1:4573/);
  assert.match(matrix, /No native PS5 package is claimed/i);
  assert.match(matrix, /no direct consumer PS5 launch path is currently marked supported/i);
});
