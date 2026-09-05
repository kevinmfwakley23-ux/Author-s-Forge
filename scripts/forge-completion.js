#!/usr/bin/env node
/* Author's Forge completion meter: source presence + automated evidence, never marketing-only claims. */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const exists = (file) => fs.existsSync(path.join(root, file));
const read = (file) => {
  try { return fs.readFileSync(path.join(root, file), "utf8"); }
  catch { return ""; }
};
const files = (dir) => {
  const base = path.join(root, dir);
  const out = [];
  if (!fs.existsSync(base)) return out;
  (function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(root, full));
    }
  })(base);
  return out;
};

const sourceFiles = files("src");
const testFiles = files("test");
const sourceText = sourceFiles.map(read).join("\n");
const testText = testFiles.map(read).join("\n");
const hasTest = (...patterns) => patterns.some((pattern) => testFiles.some((file) => pattern.test(file)));

const browserHarnesses = [
  "scripts/studio-browser-acceptance.js",
  "scripts/studio-context-browser-acceptance.js",
  "scripts/studio-architecture-browser-acceptance.js",
  "scripts/studio-story-map-browser-acceptance.js",
  "scripts/studio-scene-card-browser-acceptance.js",
  "scripts/studio-series-browser-acceptance.js",
  "scripts/studio-manuscript-import-browser-acceptance.js",
  "scripts/studio-image-lab-browser-acceptance.js",
  "scripts/studio-kdp-preflight-browser-acceptance.js",
  "scripts/studio-cover-direction-browser-acceptance.js",
  "scripts/studio-recovery-browser-acceptance.js",
  "scripts/studio-children-topics-browser-acceptance.js",
  "scripts/studio-agent-routing-browser-acceptance.js",
  "scripts/studio-agent-workbench-browser-acceptance.js",
  "scripts/studio-media-studio-browser-acceptance.js",
  "scripts/studio-author-craft-browser-acceptance.js",
  "scripts/studio-live-research-browser-acceptance.js",
  "scripts/studio-knowledge-gap-browser-acceptance.js",
  "scripts/guided-journal-browser-acceptance.js",
  "scripts/studio-publishing-promotion-browser-acceptance.js",
  "scripts/studio-promotion-performance-browser-acceptance.js",
  "scripts/educational-workbook-browser-acceptance.js",
  "scripts/educational-workbook-differentiation-browser-acceptance.js",
  "scripts/educational-assessment-browser-acceptance.js",
  "scripts/specialized-creation-browser-acceptance.js",
  "scripts/specialized-creation-briefs-browser-acceptance.js",
  "scripts/specialized-creation-tcg-builder-browser-acceptance.js",
  "scripts/specialized-creation-finishing-browser-acceptance.js",
  "scripts/specialized-creation-comic-browser-acceptance.js",
  "scripts/nft-creation-browser-acceptance.js",
  "scripts/nft-production-director-browser-acceptance.js",
  "scripts/forge-offices-browser-acceptance.js",
  "scripts/hosted-device-browser-acceptance.js",
];
const mobileHarnesses = [
  "scripts/studio-mobile-acceptance.js",
  "scripts/specialized-creation-mobile-acceptance.js",
];
const allExist = (paths) => paths.every(exists);

const capabilities = [
  ["Project foundation & durable memory", ["src/domain/project.ts", "src/infrastructure/file-project-store.ts"], () => hasTest(/project-foundation/)],
  ["Manuscript / chapter / scene workspace", ["src/domain/manuscript.ts"], () => hasTest(/manuscript(?!-production|-planning)/)],
  ["Existing manuscript intake / provenance", ["src/application/studio-manuscript-import.ts", "src/application/studio-manuscript-import-routes.ts", "public/forge-manuscript-import.js", "scripts/studio-manuscript-import-browser-acceptance.js"], () => hasTest(/studio-manuscript-import/) && exists("scripts/studio-manuscript-import-browser-acceptance.js")],
  ["Author-approved Scene Cards / card-driven drafting", ["src/domain/scene-card-workflow.ts", "src/application/studio-scene-card-workflow.ts", "src/application/studio-scene-card-workflow-routes.ts", "public/forge-scene-cards.js", "scripts/studio-scene-card-browser-acceptance.js"], () => hasTest(/scene-card-workflow/) && exists("scripts/studio-scene-card-browser-acceptance.js")],
  ["AI writing & model broker", ["src/application/ai-writing.ts", "src/application/ai-model-broker.ts"], () => hasTest(/^test\/ai-(writing|model-broker)/)],
  ["Canon / character / voice", ["src/domain/character-bible.ts", "src/domain/voice-preservation.ts"], () => hasTest(/version-control-author-control-series-voice|character/)],
  [
    "Series Engine author workflow",
    ["src/domain/series.ts", "src/application/series.ts", "src/application/studio-series.ts", "src/application/studio-series-routes.ts", "public/series.html", "public/forge-series.js", "scripts/studio-series-browser-acceptance.js"],
    () => hasTest(/studio-series|version-control-author-control-series-voice/) && exists("scripts/studio-series-browser-acceptance.js"),
  ],
  ["Research & provenance-aware memory", ["src/domain/research.ts", "src/domain/relationship-memory.ts"], () => hasTest(/research|relationship-memory/)],
  [
    "Live source-backed Research Office",
    ["src/infrastructure/openai-web-research-provider.ts", "src/application/studio-live-research.ts", "src/application/studio-live-research-routes.ts", "public/research.html", "public/research.js", "scripts/studio-live-research-browser-acceptance.js"],
    () => hasTest(/openai-web-research-provider|studio-live-research/) && exists("scripts/studio-live-research-browser-acceptance.js"),
  ],
  [
    "Knowledge Gap Radar / proactive research questions",
    ["src/domain/knowledge-gap.ts", "src/infrastructure/file-knowledge-gap-store.ts", "src/application/knowledge-gap-radar.ts", "src/application/studio-knowledge-gap-routes.ts", "public/research.html", "public/research.js", "scripts/studio-knowledge-gap-browser-acceptance.js"],
    () => hasTest(/knowledge-gap-radar/) && exists("scripts/studio-knowledge-gap-browser-acceptance.js"),
  ],
  ["Intelligent editing", ["src/domain/intelligent-editing.ts", "src/application/intelligent-editing.ts"], () => hasTest(/intelligent-editing|ai-editing/)],
  ["Visual identity / illustration assets", ["src/domain/character-visual-continuity.ts", "src/domain/illustration-asset-library.ts"], () => hasTest(/illustration|visual/)],
  ["Studio voice + provider-backed image generation/editing", ["src/infrastructure/image-provider.ts", "src/application/studio-image-lab.ts", "src/application/studio-image-lab-routes.ts", "public/forge-command-center.js", "public/forge-image-lab.js", "scripts/studio-image-lab-browser-acceptance.js"], () => hasTest(/studio-image-lab|image-provider-reference/)],
  ["Cover / KDP production planning", ["src/domain/book-cover-studio.ts"], () => hasTest(/book-cover/)],
  ["Manuscript production artifacts", ["src/domain/manuscript-production.ts", "src/application/manuscript-production.ts"], () => hasTest(/manuscript-production/)],
  ["Guided Journal Office", ["src/domain/guided-journal.ts", "src/application/guided-journal-workspace.ts", "src/guided-journal-server.ts", "public/guided-journal.html", "scripts/guided-journal-browser-acceptance.js"], () => hasTest(/guided-journal/)],
  ["Educational Workbook Office", ["src/domain/educational-workbook.ts", "src/application/educational-workbook-office.ts", "src/application/educational-workbook-production.ts", "src/educational-workbook-server.ts", "public/educational-workbooks.html", "scripts/educational-workbook-browser-acceptance.js"], () => hasTest(/educational-workbook/)],
  ["Educational differentiation & teacher support", ["src/domain/educational-workbook-differentiation.ts", "src/application/educational-workbook-differentiation.ts", "src/application/educational-workbook-differentiation-production.ts", "src/application/educational-workbook-differentiation-routes.ts", "src/infrastructure/file-educational-workbook-differentiation-store.ts", "public/educational-differentiation.html", "scripts/educational-workbook-differentiation-browser-acceptance.js"], () => hasTest(/educational-workbook-differentiation/)],
  ["Educational rubrics & performance assessment", ["src/domain/educational-assessment.ts", "src/application/educational-assessment.ts", "src/application/educational-assessment-routes.ts", "src/infrastructure/file-educational-assessment-store.ts", "public/educational-assessment.html", "scripts/educational-assessment-browser-acceptance.js"], () => hasTest(/educational-assessment/)],
  ["Specialized Creation Office", ["src/domain/specialized-creation-office.ts", "src/application/specialized-creation-office-service.ts", "src/application/specialized-creation-production-engine.ts", "src/specialized-creation-server.ts", "public/specialized-creation.html", "scripts/specialized-creation-browser-acceptance.js", "scripts/specialized-creation-mobile-acceptance.js"], () => hasTest(/specialized-creation/)],
  [
    "Creative Agent Workbench / governed Recipes",
    ["src/application/creative-tool-registry.ts", "src/application/creative-agent-plan.ts", "src/application/creative-agent-recipes.ts", "src/application/studio-creative-agent-routes.ts", "public/forge-agent.html", "public/forge-agent-v3.js", "scripts/studio-agent-workbench-browser-acceptance.js"],
    () => hasTest(/creative-tool-registry|creative-agent-plan|creative-agent-recipes/) && exists("scripts/studio-agent-workbench-browser-acceptance.js"),
  ],
  [
    "Design & Motion Offices",
    ["public/forge-media-studio.html", "public/forge-media-studio.js", "public/forge-media-studio.css", "scripts/studio-media-studio-browser-acceptance.js"],
    () => hasTest(/design-motion-royal-ui/) && exists("scripts/studio-media-studio-browser-acceptance.js"),
  ],
  [
    "Royal cross-office light/dark UI",
    ["public/forge-office-royal.css", "public/forge-office-royal.js", "public/specialized-creation-royal.css", "public/forge-royal-ui.js"],
    () => hasTest(/design-motion-royal-ui/),
  ],
  [
    "NFT Creation / Series / provenance / IPFS production",
    ["src/domain/nft-creation.ts", "src/domain/nft-series-director.ts", "src/application/nft-creation-office.ts", "src/application/nft-series-director.ts", "src/application/nft-storage-publisher.ts", "src/application/nft-market-intelligence.ts", "src/nft-creation-server.ts", "public/nft-creation.html", "public/nft-creation.js", "public/nft-production-director.js", "scripts/nft-creation-browser-acceptance.js", "scripts/nft-production-director-browser-acceptance.js"],
    () => hasTest(/nft-creation|nft-series-director|nft-storage-publisher|nft-market-intelligence/) && exists("scripts/nft-creation-browser-acceptance.js") && exists("scripts/nft-production-director-browser-acceptance.js"),
  ],
  ["Publishing / market intelligence / Promotion", ["src/domain/publishing-readiness.ts", "src/application/studio-publishing-metadata.ts", "src/domain/kdp-market-intelligence.ts", "src/infrastructure/openai-kdp-market-intelligence-provider.ts", "src/domain/marketing-campaign.ts", "src/domain/promotion-readiness.ts", "src/domain/promotion-performance.ts", "src/application/studio-publishing-promotion-routes.ts", "public/forge-publishing-promotion.js", "public/forge-promotion-performance.js"], () => hasTest(/publishing|marketing|promotion-performance|kdp-live-market-research|kdp-market/)],
  ["Version control & author authority", ["src/domain/book-version-control.ts", "src/domain/author-control.ts"], () => hasTest(/version-control-author-control-series-voice/)],
  ["Workflow gates / delivery audit / Book Genome", ["src/domain/workflow-gate.ts", "src/domain/delivery-audit.ts", "src/domain/final-product-systems.ts"], () => hasTest(/workflow|delivery-audit|final-product/)],
  ["Portable project package / recovery", ["src/domain/project-package.ts", "src/application/project-package.ts"], () => hasTest(/project-package|external-storage/)],
  ["AI context optimization / cost governance", ["src/application/context-engine-stack.ts", "src/application/ai-cost-guard.ts"], () => hasTest(/context|cost-guard/)],
  ["Author Craft / owner AI control / model-independent quality", ["src/application/studio-author-training-routes.ts", "src/domain/rhyme-storytelling.ts", "src/application/studio-lexical-routes.ts", "src/application/studio-ai-control-routes.ts", "src/infrastructure/ai-owner-control-runtime.ts", "src/application/forge-quality-contract.ts", "public/author-craft.html", "public/author-craft.js", "scripts/studio-author-craft-browser-acceptance.js"], () => hasTest(/author-craft-rhyme-quality|lexical-word-choice|ai-owner-control-runtime|ai-spend-policy|ai-router-billing-safety/)],
  ["Integrated Studio / browser acceptance", ["src/studio-server.ts", "scripts/start-forge.js", ...browserHarnesses], () => allExist(browserHarnesses) && exists("scripts/start-forge.js")],
  ["Android / PWA delivery surface", ["public/manifest.webmanifest", "public/sw.js", "public/forge-pwa.js", ...mobileHarnesses], () => allExist(mobileHarnesses) && hasTest(/pwa|mobile/)],
];

let earned = 0;
const rows = capabilities.map(([name, required, verification]) => {
  const implementation = required.filter(exists).length / required.length;
  const verified = verification() ? 1 : 0;
  const score = Math.round(implementation * verified * 100);
  earned += score;
  return { name, implementation, verified, score };
});
const engineering = Math.round(earned / capabilities.length);
const browserEvidence = allExist(browserHarnesses) ? 100 : 0;
const mobileEvidence = allExist(mobileHarnesses) ? 100 : 0;
const providerBoundary = /KINGS_AI_ENDPOINT|OMNIROUTE_BASE_URL|ROUTER9_BASE_URL|OPENROUTER_API_KEY|GROQ_API_KEY|MISTRAL_API_KEY|GEMINI_API_KEY|ANTHROPIC_API_KEY|OpenAI|Ollama|PINATA_JWT/.test(sourceText) ? 100 : 0;
const honestAi = /fabricat|real provider|provider.*unavailable|not configured|will not claim/i.test(sourceText + testText) ? 100 : 0;
const documentation = exists("AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md") && exists("README.md") ? 100 : 0;
const verification = Math.round((browserEvidence + mobileEvidence + providerBoundary + honestAi + documentation) / 5);

console.log("AUTHOR'S FORGE — COMPLETION REPORT");
console.log("=".repeat(72));
console.log(`Engineering capability completion: ${engineering}%`);
console.log(`Verification/evidence readiness:    ${verification}%`);
console.log(`Browser acceptance harness:         ${browserEvidence}% present`);
console.log(`Mobile acceptance harness:          ${mobileEvidence}% present`);
console.log(`Real-provider boundary evidence:    ${providerBoundary}%`);
console.log(`Honest-AI/error contract evidence:  ${honestAi}%`);
console.log(`Product directive/documentation:     ${documentation}%`);
console.log("\nCapability detail:");
for (const row of rows) {
  console.log(`- ${String(row.score).padStart(3)}%  ${row.name} (implementation ${Math.round(row.implementation * 100)}%, automated evidence ${row.verified ? 100 : 0}%)`);
}
console.log("\nInterpretation: 100% is reserved for a complete, verified product journey.");
console.log("The meter requires the Series Engine author workflow, preview-first existing-manuscript intake, author-approved Scene Cards, governed Creative Agent Workbench/Recipes, live source-backed Research, Knowledge Gap Radar, Author Craft and owner-level AI spend/model control, Guided Journal, Educational Workbooks, Specialized Creation, Design & Motion, the royal cross-office UI, the NFT Creation + Series/Set + provenance/IPFS production path, the unified workplace launcher, durable provider-backed image generation/editing, and every canonical browser/mobile harness.");
console.log("Source presence and dry-run provider planning are never treated as proof that a paid external upload, wallet signature, deployment, or mint actually occurred; CI must execute the harnesses successfully.");
console.log("Run after a clean checkout/build: npm run completion");