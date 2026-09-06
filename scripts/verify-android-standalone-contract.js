#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const failures = [];
const requireMatch = (text, pattern, message) => { if (!pattern.test(text)) failures.push(message); };
const forbidMatch = (text, pattern, message) => { if (pattern.test(text)) failures.push(message); };

const runtime = read("src-tauri/src/runtime.rs");
const lib = read("src-tauri/src/lib.rs");
const cargo = read("src-tauri/Cargo.toml");
const nativeProjectStore = read("src-tauri/src/native_project_store.rs");
const nativeProvider = read("src-tauri/src/native_provider.rs");
const index = read("native-shell/index.html");
const app = read("native-shell/app.js");

requireMatch(runtime, /STANDALONE_ANDROID_RUNTIME_READY:\s*bool\s*=\s*true\s*;/, "Native runtime readiness flag is not true. Full standalone Android runtime has not been certified.");
requireMatch(lib, /native_runtime_status/, "Native runtime status command is not registered.");
requireMatch(lib, /native_offices/, "Native office registry command is not registered.");

for (const office of ["studio", "journal", "workbooks", "specialized", "nft"]) {
  requireMatch(runtime, new RegExp(`id:\\s*"${office}"`), `Native runtime is missing the ${office} office descriptor.`);
}

for (const command of [
  "forge_native_project_put",
  "forge_native_project_get",
  "forge_native_project_list",
  "forge_native_project_delete",
]) {
  requireMatch(lib, new RegExp(command), `Native runtime is not registering durable project command ${command}.`);
  requireMatch(nativeProjectStore, new RegExp(`fn\\s+${command}`), `Native durable project store is missing ${command}.`);
}
requireMatch(nativeProjectStore, /StoreExt/, "Native durable project store is not using the Tauri persistent Store adapter.");
requireMatch(nativeProjectStore, /\.save\(\)/, "Native durable project writes do not explicitly flush to persistent storage.");
requireMatch(nativeProvider, /forge_native_generate_text/, "Native provider runtime does not expose real text generation.");

forbidMatch(index, /Forge address|hosted K\.I\.N\.G\.S\.|connect-form|forge-url/i, "Native shell still asks for a remote/hosted Forge runtime URL.");
forbidMatch(app, /window\.location\.assign\s*\(|authors-forge-native-url|validateForgeUrl/i, "Native shell still navigates to an external Forge runtime.");

for (const capability of [
  [cargo, /sqlite|sqlx|tauri-plugin-sql|tauri-plugin-store/i, "Native Android runtime has no durable database/storage adapter dependency."],
  [cargo, /stronghold|keyring|secure/i, "Native Android runtime has no secure credential-vault dependency."],
  [cargo, /reqwest|tauri-plugin-http|hyper/i, "Native Android runtime has no native HTTP/provider transport dependency."],
]) {
  if (!capability[1].test(capability[0])) failures.push(capability[2]);
}

if (failures.length) {
  console.error("Android standalone Forge contract: NOT READY");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("No Android artifact from this source may be labeled a standalone/private-test Forge build.");
  process.exit(1);
}

console.log("Android standalone Forge contract: source gates passed.");
console.log("Device acceptance and live-provider certification are still required before release acceptance.");
