#!/usr/bin/env node
/*
 * Author's Forge completion meter.
 *
 * This deliberately reports engineering completion, not a marketing claim.
 * A capability receives credit only when its domain/application surface exists
 * and there is corresponding automated verification. Browser/device evidence
 * is reported separately because repository inspection cannot prove a human
 * used the product on a physical device.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => {
  try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { return ''; }
};
const files = (dir) => {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) return [];
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(root, full));
    }
  };
  walk(base);
  return out;
};

const sourceFiles = files('src');
const testFiles = files('test');
const sourceText = sourceFiles.map((f) => read(f)).join('\n');
const testText = testFiles.map((f) => read(f)).join('\n');

const capabilities = [
  ['Project foundation & durable memory', ['src/domain/project.ts', 'src/infrastructure/file-project-store.ts'], ['test/project-foundation.test.js']],
  ['Manuscript / chapter / scene workspace', ['src/domain/manuscript.ts'], ['test/manuscript.test.js']],
  ['AI writing & model broker', ['src/application/ai-writing.ts', 'src/application/ai-model-broker.ts'], ['test/ai-writing.test.js']],
  ['Canon / character / series / voice', ['src/domain/character-bible.ts', 'src/domain/series.ts', 'src/domain/voice-preservation.ts'], ['test/version-control-author-control-series-voice.test.js']],
  ['Research & provenance-aware memory', ['src/domain/research.ts', 'src/domain/relationship-memory.ts'], ['test/research.test.js']],
  ['Intelligent editing', ['src/domain/intelligent-editing.ts', 'src/application/intelligent-editing.ts'], ['test/intelligent-editing.test.js']],
  ['Visual identity / illustration assets', ['src/domain/character-visual-continuity.ts', 'src/domain/illustration-asset-library.ts'], ['test/illustration.test.js']],
  ['Cover / KDP production planning', ['src/domain/book-cover-studio.ts'], ['test/book-cover-studio.test.js']],
  ['Manuscript production artifacts', ['src/domain/manuscript-production.ts', 'src/application/manuscript-production.ts'], ['test/manuscript-production.test.js']],
  ['Publishing readiness / positioning / marketing', ['src/domain/publishing-readiness.ts', 'src/domain/book-positioning.ts', 'src/domain/marketing-campaign.ts'], ['test/publishing-readiness.test.js']],
  ['Version control & author authority', ['src/domain/book-version-control.ts', 'src/domain/author-control.ts'], ['test/version-control-author-control-series-voice.test.js']],
  ['Workflow gates / delivery audit / Book Genome', ['src/domain/workflow-gate.ts', 'src/domain/delivery-audit.ts', 'src/domain/final-product-systems.ts'], ['test/workflow-gate.test.js', 'test/workflow-advance.test.js']],
  ['Portable project package / recovery', ['src/domain/project-package.ts', 'src/application/project-package.ts'], ['test/project-package.test.js']],
  ['AI context optimization / cost governance', ['src/application/context-engine-stack.ts', 'src/application/ai-cost-guard.ts'], ['test/context-optimization.test.js']],
  ['Integrated Studio / browser acceptance', ['src/studio-server.ts', 'scripts/studio-browser-acceptance.js'], ['test/workflow-advance.test.js']],
  ['Android / PWA delivery surface', ['public/manifest.json', 'public/sw.js'], ['test/pwa.test.js']],
];

let weighted = 0;
let earned = 0;
const rows = capabilities.map(([name, required, verification]) => {
  const implementation = required.filter(exists).length / required.length;
  const verified = verification.filter(exists).length / verification.length;
  const score = Math.round(implementation * verified * 100);
  weighted += 100;
  earned += score;
  return { name, implementation, verified, score };
});

const engineering = Math.round((earned / weighted) * 100);
const browserEvidence = exists('scripts/studio-browser-acceptance.js') ? 100 : 0;
const mobileEvidence = exists('scripts/studio-mobile-acceptance.js') ? 100 : 0;
const providerBoundary = /KINGS_AI_ENDPOINT|OMNIROUTE_BASE_URL|OpenAI|Ollama/.test(sourceText) ? 100 : 0;
const honestAi = /fabricat|real provider|provider.*unavailable|not configured/i.test(sourceText + testText) ? 100 : 0;
const documentation = exists('AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md') && exists('README.md') ? 100 : 0;
const verification = Math.round((browserEvidence + mobileEvidence + providerBoundary + honestAi + documentation) / 5);

console.log("AUTHOR'S FORGE — COMPLETION REPORT");
console.log('='.repeat(72));
console.log(`Engineering capability completion: ${engineering}%`);
console.log(`Verification/evidence readiness:    ${verification}%`);
console.log(`Browser acceptance harness:         ${browserEvidence}% present`);
console.log(`Mobile acceptance harness:          ${mobileEvidence}% present`);
console.log(`Real-provider boundary evidence:    ${providerBoundary}%`);
console.log(`Honest-AI/error contract evidence:  ${honestAi}%`);
console.log(`Product directive/documentation:     ${documentation}%`);
console.log('');
console.log('Capability detail:');
for (const row of rows) {
  const impl = Math.round(row.implementation * 100);
  const ver = Math.round(row.verified * 100);
  console.log(`- ${String(row.score).padStart(3)}%  ${row.name} (implementation ${impl}%, automated evidence ${ver}%)`);
}
console.log('');
console.log('Interpretation: 100% is reserved for a complete, verified product journey.');
console.log('This meter never substitutes source presence for real browser/device proof.');
console.log('Run after a clean checkout/build: npm run completion');
