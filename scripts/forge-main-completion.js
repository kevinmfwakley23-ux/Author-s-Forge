#!/usr/bin/env node
const { existsSync } = require("node:fs");
const { resolve, join } = require("node:path");

const root = resolve(__dirname, "..");
const groups = [
  ["Project + durable state", [
    "src/domain/project.ts",
    "src/domain/studio-workspace.ts",
    "src/infrastructure/file-project-store.ts",
    "src/application/project-package.ts",
    "src/application/studio-project-recovery.ts",
  ]],
  ["Idea / planning / canon", [
    "src/domain/final-product-systems.ts",
    "src/domain/character-bible.ts",
    "src/domain/author-voice-memory.ts",
    "src/domain/scene-card-workflow.ts",
    "src/application/studio-scene-card-workflow.ts",
    "src/application/studio-manuscript-import.ts",
  ]],
  ["Real AI writing", [
    "src/application/ai-model-broker.ts",
    "src/application/ai-execution-fallback.ts",
    "src/infrastructure/ai-provider.ts",
    "src/application/ai-writing-coordinator.ts",
    "src/application/ai-writing-studio.ts",
    "src/application/studio-ai-writing-http.ts",
    "src/infrastructure/main-studio-ai-runtime.ts",
  ]],
  ["Editing + author control", [
    "src/application/intelligent-editing.ts",
    "src/application/ai-editing-studio.ts",
    "src/domain/author-control.ts",
    "src/domain/ai-collaboration.ts",
  ]],
  ["Visual + cover", [
    "src/application/studio-image-lab.ts",
    "src/infrastructure/image-provider.ts",
    "src/application/book-cover-studio.ts",
    "src/domain/book-cover-studio.ts",
  ]],
  ["Production / KDP / export", [
    "src/application/manuscript-production.ts",
    "src/domain/manuscript-production.ts",
    "src/application/kdp-preflight-http.ts",
    "src/application/studio-publishing-metadata.ts",
  ]],
  ["Publishing + promotion", [
    "src/application/studio-publishing-promotion-routes.ts",
    "src/domain/marketing-campaign.ts",
    "src/domain/promotion-readiness.ts",
    "src/domain/promotion-performance.ts",
  ]],
  ["Integrated Studio runtime", [
    "src/studio-server.ts",
    "scripts/start-forge.js",
    "scripts/start-forge-web.js",
    "public/index.html",
    "public/app.js",
  ]],
];

const browserHarnesses = [
  "scripts/studio-browser-acceptance.js",
  "scripts/studio-ai-writing-operational-browser-acceptance.js",
  "scripts/studio-context-browser-acceptance.js",
  "scripts/studio-architecture-browser-acceptance.js",
  "scripts/studio-brand-kit-browser-acceptance.js",
  "scripts/studio-story-map-browser-acceptance.js",
  "scripts/studio-scene-card-browser-acceptance.js",
  "scripts/studio-series-browser-acceptance.js",
  "scripts/studio-manuscript-import-browser-acceptance.js",
  "scripts/studio-image-lab-browser-acceptance.js",
  "scripts/studio-kdp-preflight-browser-acceptance.js",
  "scripts/studio-cover-direction-browser-acceptance.js",
  "scripts/studio-recovery-browser-acceptance.js",
  "scripts/studio-children-topics-browser-acceptance.js",
  "scripts/studio-agent-planner-api-acceptance.js",
  "scripts/studio-agent-routing-browser-acceptance.js",
  "scripts/studio-agent-workbench-browser-acceptance.js",
  "scripts/studio-media-studio-browser-acceptance.js",
  "scripts/studio-author-craft-browser-acceptance.js",
  "scripts/studio-live-research-browser-acceptance.js",
  "scripts/studio-knowledge-gap-browser-acceptance.js",
  "scripts/studio-publishing-promotion-browser-acceptance.js",
  "scripts/studio-promotion-performance-browser-acceptance.js",
  "scripts/hosted-main-studio-browser-acceptance.js",
];
const mobileHarnesses = [
  "scripts/run-studio-mobile-acceptance.js",
  "scripts/android-install-browser-acceptance.js",
  "scripts/hosted-main-webkit-mobile-acceptance.js",
];

const missing = [];
for (const [name, files] of groups) {
  const absent = files.filter((file) => !existsSync(join(root, file)));
  if (absent.length) missing.push({ name, files: absent });
}
for (const file of [...browserHarnesses, ...mobileHarnesses]) {
  if (!existsSync(join(root, file))) missing.push({ name: "Acceptance evidence", files: [file] });
}

console.log("K.I.N.G.S. AUTHOR'S FORGE — MAIN STUDIO COMPLETION GATE");
console.log("=".repeat(72));
console.log("Scope: idea -> planning -> writing -> editing -> visual/cover -> production -> publishing/promotion");
console.log("Optional offices (Guided Journals, Workbooks, Specialized Creation, NFT) are deliberately excluded.");

if (missing.length) {
  console.log("Status: BLOCKED");
  for (const item of missing) {
    console.log(`- ${item.name}`);
    for (const file of item.files) console.log(`  missing: ${file}`);
  }
  process.exit(1);
}

console.log(`Status: READY FOR EXECUTED VERIFICATION (${groups.length} capability groups, ${browserHarnesses.length} browser gates, ${mobileHarnesses.length} mobile gates present)`);
console.log("This gate does not claim external retailer publication or paid-provider success without live credentials/evidence.");
