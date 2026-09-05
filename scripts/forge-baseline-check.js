#!/usr/bin/env node

/**
 * Canonical checkout sanity check.
 *
 * This is intentionally small and dependency-free. It catches the recurring
 * failure mode where a stale local dist/ directory is tested against newer
 * source exports. It never treats source presence as a substitute for the
 * real build or browser acceptance suites.
 */
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");
const required = [
  "dist/index.js",
  "dist/studio-server.js",
  "dist/application/studio-image-lab.js",
  "dist/application/studio-image-lab-routes.js",
  "dist/guided-journal-server.js",
  "dist/educational-workbook-server.js",
  "dist/specialized-creation-server.js",
  "dist/nft-creation-server.js",
  "dist/application/nft-series-director.js",
  "dist/application/nft-storage-publisher.js",
  "scripts/start-forge.js",
  "scripts/forge-offices-browser-acceptance.js",
  "scripts/studio-image-lab-browser-acceptance.js",
  "scripts/studio-media-studio-browser-acceptance.js",
  "scripts/nft-creation-browser-acceptance.js",
  "scripts/nft-production-director-browser-acceptance.js",
  "public/index.html",
  "public/forge-image-lab.js",
  "public/forge-media-studio.html",
  "public/forge-media-studio.js",
  "public/guided-journal.html",
  "public/educational-workbooks.html",
  "public/specialized-creation.html",
  "public/nft-creation.html",
  "public/nft-creation.js",
  "public/nft-production-director.js",
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
console.log("Canonical Studio + Image Lab, Design & Motion, Guided Journal, Educational Workbooks, Specialized Creation, NFT Creation/Production Director, and unified launcher surfaces are present.");
console.log("Next: npm run verify");
