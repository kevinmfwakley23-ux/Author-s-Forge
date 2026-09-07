#!/usr/bin/env node
const { existsSync, statSync } = require("node:fs");
const { resolve, join } = require("node:path");

const root = resolve(__dirname, "..");
const required = [
  "dist/studio-server.js",
  "dist/application/ai-model-broker.js",
  "dist/application/ai-writing-coordinator.js",
  "dist/application/ai-writing-studio.js",
  "dist/application/intelligent-editing.js",
  "dist/application/manuscript-production.js",
  "dist/application/book-cover-studio.js",
  "dist/application/studio-publishing-promotion-routes.js",
  "dist/infrastructure/ai-provider.js",
  "dist/infrastructure/file-project-store.js",
  "dist/public/index.html",
  "dist/public/app.js",
  "dist/public/forge-ai-proposals.js",
  "dist/public/forge-editing-proposals.js",
  "dist/public/forge-image-lab.js",
  "dist/public/forge-kdp-preflight.js",
  "dist/public/forge-publishing-promotion.js",
];

const missing = [];
for (const relative of required) {
  const path = join(root, relative);
  if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size === 0) missing.push(relative);
}

if (missing.length) {
  console.error("[Forge main baseline] BLOCKED — required main Studio build artifacts are missing or empty:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`[Forge main baseline] PASS — ${required.length} required main Studio artifacts are present and non-empty.`);
console.log("[Forge main baseline] Optional offices are intentionally outside this production gate.");
