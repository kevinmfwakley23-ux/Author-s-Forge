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

test("native shell uses only the device-local Tauri runtime rather than a remote Forge gateway", () => {
  const native = read("native-shell/app.js");
  const shell = read("native-shell/index.html");
  assert.doesNotThrow(() => new vm.Script(native, { filename: "native-shell/app.js" }));
  assert.match(native, /native_runtime_status/);
  assert.match(native, /window\.__TAURI__/);
  assert.doesNotMatch(native, /window\.location\.assign|validateForgeUrl|authors-forge-native-url|WebView CORS/);
  assert.doesNotMatch(shell, /connect-form|forge-url|http:\/\/127\.0\.0\.1:4173|hosted K\.I\.N\.G\.S\./i);
  assert.match(shell, /No Chromebook dependency/i);
  assert.match(shell, /No gateway fallback/i);
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

test("native shell labels standalone Android readiness truthfully and keeps office-app evolution visible", () => {
  const shell = read("native-shell/index.html");
  const native = read("native-shell/app.js");
  assert.match(shell, /Forge on this device/i);
  assert.match(shell, /Forge offices/i);
  assert.match(shell, /K\.I\.N\.G\.S\.-branded applications/i);
  assert.match(native, /standaloneAndroidRuntimeReady === true/);
  assert.match(native, /not an accepted private-test build yet/i);
  assert.match(native, /local persistence, secure office credentials, native provider transport, independent office brains/i);
});
