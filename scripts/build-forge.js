#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const buildDir = path.join(root, ".forge-build");
const distDir = path.join(root, "dist");
const publicDir = path.join(root, "public");
const tsconfig = path.join(root, "tsconfig.json");

function removeTree(target) {
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

function fail(message, code = 1) {
  console.error(`[Forge build] ${message}`);
  process.exit(code);
}

if (!fs.existsSync(tsconfig)) fail(`Missing TypeScript configuration: ${tsconfig}`);
if (!fs.existsSync(publicDir)) fail(`Missing public assets directory: ${publicDir}`);

let tscPath;
try {
  tscPath = require.resolve("typescript/bin/tsc", { paths: [root] });
} catch (error) {
  fail(`TypeScript compiler is not installed. Run npm ci first. ${error instanceof Error ? error.message : String(error)}`);
}

removeTree(buildDir);
removeTree(distDir);

const compile = spawnSync(process.execPath, [tscPath, "-p", tsconfig], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

if (compile.error) fail(`Could not launch TypeScript compiler: ${compile.error.message}`);
if (compile.status !== 0) {
  fail(`TypeScript compilation failed${compile.signal ? ` (${compile.signal})` : ""}.`, compile.status || 1);
}
if (!fs.existsSync(buildDir)) fail("TypeScript completed without producing .forge-build.");

try {
  fs.cpSync(buildDir, distDir, { recursive: true, force: true });
  fs.cpSync(publicDir, path.join(distDir, "public"), { recursive: true, force: true });
} catch (error) {
  removeTree(distDir);
  fail(`Could not assemble dist/: ${error instanceof Error ? error.message : String(error)}`);
}

console.log(`[Forge build] Compiled runtime and copied public assets to ${distDir}`);
