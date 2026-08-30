#!/usr/bin/env node

/**
 * Canonical checkout sanity check.
 *
 * This is intentionally small and dependency-free. It catches the recurring
 * failure mode where a stale local dist/ directory is tested against newer
 * source exports. It never treats source presence as a substitute for the
 * real build or browser acceptance suites.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const required = [
  "dist/index.js",
  "dist/studio-server.js",
  "public/index.html",
  "public/manifest.webmanifest",
  "public/sw.js",
];

const missing = required.filter((relativePath) => !existsSync(resolve(root, relativePath)));
if (missing.length) {
  console.error("FORGE BASELINE CHECK FAILED");
  console.error("Missing generated/runtime files:");
  for (const path of missing) console.error(`  - ${path}`);
  console.error("Run: npm run build");
  process.exit(1);
}

console.log("FORGE BASELINE CHECK PASSED");
console.log("Canonical generated/runtime surface is present.");
console.log("Next: npm test && npm run test:browser && npm run test:browser:mobile");
