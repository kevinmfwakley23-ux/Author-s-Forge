#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const androidApp = path.join(root, "src-tauri", "gen", "android", "app");
const ndkRoot = process.env.ANDROID_NDK_HOME || process.env.NDK_HOME || "";
const abiTriples = {
  "arm64-v8a": "aarch64-linux-android",
  "armeabi-v7a": "arm-linux-androideabi",
  "x86_64": "x86_64-linux-android",
};

function fail(message) { throw new Error(`[Forge Android native finalize] ${message}`); }
function walk(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute, predicate, results);
    else if (predicate(absolute, entry.name)) results.push(absolute);
  }
  return results;
}

if (!fs.existsSync(androidApp)) fail(`Generated Android app does not exist: ${androidApp}`);
if (!ndkRoot || !fs.existsSync(ndkRoot)) fail(`ANDROID_NDK_HOME/NDK_HOME is missing or invalid: ${ndkRoot || "<unset>"}`);

for (const [abi, triple] of Object.entries(abiTriples)) {
  const matches = walk(ndkRoot, (absolute, name) => name === "libc++_shared.so" && absolute.includes(`${path.sep}${triple}${path.sep}`));
  if (matches.length !== 1) fail(`Expected exactly one libc++_shared.so for ${abi} (${triple}); found ${matches.length}.`);
  const destination = path.join(androidApp, "src", "main", "jniLibs", abi, "libc++_shared.so");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(matches[0], destination);
  if (fs.statSync(destination).size < 100000) fail(`Copied libc++_shared.so for ${abi} is unexpectedly small.`);
}

const mainActivities = walk(path.join(androidApp, "src", "main", "java"), (_absolute, name) => name === "MainActivity.kt");
if (mainActivities.length !== 1) fail(`Expected exactly one MainActivity.kt; found ${mainActivities.length}.`);
const mainActivity = mainActivities[0];
let kotlin = fs.readFileSync(mainActivity, "utf8");
const unsafeOrder = `    override fun onCreate(savedInstanceState: Bundle?) {\n        startEmbeddedForge()\n        super.onCreate(savedInstanceState)\n    }`;
const safeOrder = `    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        startEmbeddedForge()\n    }`;
if (kotlin.includes(unsafeOrder)) kotlin = kotlin.replace(unsafeOrder, safeOrder);
if (!kotlin.includes(safeOrder)) fail("MainActivity does not contain the expected safe Tauri/Forge startup order.");
fs.writeFileSync(mainActivity, kotlin);

for (const abi of Object.keys(abiTriples)) {
  for (const library of ["libnode.so", "libc++_shared.so"]) {
    const file = path.join(androidApp, "src", "main", "jniLibs", abi, library);
    if (!fs.existsSync(file)) fail(`Missing ${abi}/${library} after native finalization.`);
  }
}

console.log("[Forge Android native finalize] Shared C++ runtime and safe Activity startup are locked for arm64-v8a, armeabi-v7a, and x86_64.");
