#!/usr/bin/env node
const { existsSync, readFileSync } = require("node:fs");
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
    "test/ai-routing-hermetic-integration.test.js",
    "test/studio-ai-writing-operational.integration.test.js",
  ]],
  ["Editing + author control", [
    "src/application/intelligent-editing.ts",
    "src/application/ai-editing-studio.ts",
    "src/domain/author-control.ts",
    "src/domain/ai-collaboration.ts",
  ]],
  ["Visual + verified final cover", [
    "src/application/studio-image-lab.ts",
    "src/infrastructure/image-provider.ts",
    "src/application/book-cover-studio.ts",
    "src/domain/book-cover-studio.ts",
    "src/application/studio-cover-artifact.ts",
    "src/application/studio-cover-artifact-routes.ts",
    "src/domain/cover-artifact-evidence.ts",
    "src/infrastructure/file-cover-artifact-vault.ts",
    "public/forge-cover-production.js",
  ]],
  ["Production / KDP / export", [
    "src/application/manuscript-production.ts",
    "src/domain/manuscript-production.ts",
    "src/application/kdp-preflight-http.ts",
    "src/application/studio-publishing-metadata.ts",
    "test/studio-production-release-evidence.test.js",
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

const contractErrors = verifyExecutionContract();

console.log("K.I.N.G.S. AUTHOR'S FORGE — MAIN STUDIO COMPLETION GATE");
console.log("=".repeat(72));
console.log("Scope: idea -> planning -> writing -> editing -> visual/cover -> production -> publishing/promotion");
console.log("Optional offices (Guided Journals, Workbooks, Specialized Creation, NFT) are deliberately excluded.");

if (missing.length || contractErrors.length) {
  console.log("Status: BLOCKED");
  for (const item of missing) {
    console.log(`- ${item.name}`);
    for (const file of item.files) console.log(`  missing: ${file}`);
  }
  if (contractErrors.length) {
    console.log("- Executed-verification contract");
    for (const error of contractErrors) console.log(`  ${error}`);
  }
  process.exit(1);
}

console.log(`Status: READY FOR EXECUTED VERIFICATION (${groups.length} capability groups, ${browserHarnesses.length} browser gates, ${mobileHarnesses.length} mobile gates present)`);
console.log("Execution contract: npm run verify still requires main tests, baseline, this completion gate, browser acceptance, and mobile acceptance.");
console.log("This gate does not claim external retailer publication or paid-provider success without live credentials/evidence.");

function verifyExecutionContract() {
  const failures = [];
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  } catch (error) {
    failures.push(`package.json could not be read: ${error instanceof Error ? error.message : String(error)}`);
    return failures;
  }

  const scripts = pkg && typeof pkg === "object" && pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
  const verify = typeof scripts.verify === "string" ? scripts.verify : "";
  const verifyCommands = verify.split(/\s*&&\s*/).map((command) => command.trim()).filter(Boolean);
  const requiredVerifySteps = ["test:main", "baseline", "completion", "test:browser", "test:browser:mobile"];
  for (const step of requiredVerifySteps) {
    if (!verifyCommands.includes(`npm run ${step}`)) failures.push(`package.json verify no longer runs ${step}.`);
  }
  if (typeof scripts["test:main"] !== "string" || !scripts["test:main"].split(/\s*&&\s*/).some((command) => command.trim() === "node scripts/run-main-tests.js")) {
    failures.push("package.json test:main no longer routes through scripts/run-main-tests.js.");
  }

  const canonicalWorkflow = readText(".github/workflows/canonical-verification.yml", failures);
  if (canonicalWorkflow && !hasYamlRun(canonicalWorkflow, "npm run verify")) {
    failures.push("Canonical Forge Verification no longer runs npm run verify.");
  }
  const mainCi = readText(".github/workflows/ci.yml", failures);
  if (mainCi) {
    for (const command of ["npm run test:main", "npm run baseline", "npm run completion", "npm run test:browser", "npm run test:browser:mobile"]) {
      if (!hasYamlRun(mainCi, command)) failures.push(`Forge Main Studio CI no longer runs ${command}.`);
    }
  }
  return failures;
}

function hasYamlRun(source, command) {
  return source.split(/\r?\n/).some((line) => line.trim() === `- run: ${command}` || line.trim() === `run: ${command}`);
}

function readText(relativePath, failures) {
  try {
    return readFileSync(join(root, relativePath), "utf8");
  } catch (error) {
    failures.push(`${relativePath} could not be read: ${error instanceof Error ? error.message : String(error)}`);
    return "";
  }
}
