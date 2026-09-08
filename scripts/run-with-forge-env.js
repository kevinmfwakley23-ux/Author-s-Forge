#!/usr/bin/env node
"use strict";

const { existsSync, statSync } = require("node:fs");
const { resolve } = require("node:path");
const { loadForgeLocalEnv } = require("./forge-local-env");

const targetArg = String(process.argv[2] || "").trim();
if (!targetArg) {
  console.error("Usage: node scripts/run-with-forge-env.js <forge-entrypoint> [...args]");
  process.exit(2);
}

const target = resolve(process.cwd(), targetArg);
if (!existsSync(target) || !statSync(target).isFile()) {
  console.error(`Forge entrypoint does not exist: ${target}`);
  process.exit(2);
}

const envResult = loadForgeLocalEnv();
if (envResult.loaded && process.env.FORGE_ENV_QUIET !== "1") {
  console.log(`[Forge] Loaded local runtime configuration from ${envResult.filePath}. Secret values are not logged.`);
}

const forwardedArgs = process.argv.slice(3);
process.argv = [process.execPath, target, ...forwardedArgs];
require(target);
