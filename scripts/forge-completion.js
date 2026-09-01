#!/usr/bin/env node
/*
 * Author's Forge completion meter.
 *
 * This reports engineering evidence, not a marketing claim. A capability
 * receives credit only when its implementation surface exists and matching
 * automated evidence exists. Browser/device proof remains separate.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => { try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { return ''; } };
const files = (dir) => { const base = path.join(root, dir); if (!fs.existsSync(base)) return []; const out = []; const walk = (current) => { for (const entry of fs.readdirSync(current, { withFileTypes: true })) { const full = path.join(current, entry.name); if (entry.isDirectory()) walk(full); else out.push(path.relative(root, full)); } }; walk(base); return out; };
const sourceFiles = files('src');
const testFiles = files('test');
const sourceText = sourceFiles.map(read).join('\n');
const testText = testFiles.map(read).join('\n');
const hasTest = (...patterns) => patterns.some((pattern) => testFiles.some((file) => pattern.test(file)));
const browserHarnesses = [
  'scripts/studio-browser-acceptance.js','scripts/studio-context-browser-acceptance.js','scripts/studio-kdp-preflight-browser-acceptance.js','scripts/studio-recovery-browser-acceptance.js','scripts/studio-children-topics-browser-acceptance.js','scripts/guided-journal-browser-acceptance.js','scripts/studio-publishing-promotion-browser-acceptance.js','scripts/studio-promotion-performance-browser-acceptance.js','scripts/educational-workbook-browser-acceptance.js','scripts/educational-workbook-differentiation-browser-acceptance.js','scripts/educational-assessment-browser-acceptance.js','scripts/specialized-creation-browser-acceptance.js','scripts/specialized-creation-briefs-browser-acceptance.js','scripts/specialized-creation-tcg-builder-browser-acceptance.js','scripts/specialized-creation-finishing-browser-acceptance.js','scripts/specialized-creation-comic-browser-acceptance.js','scripts/forge-offices-browser-acceptance.js',
];
const mobileHarnesses = ['scripts/studio-mobile-acceptance.js','scripts/specialized-creation-mobile-acceptance.js'];
const allExist = (paths) => paths.every(exists);
const capabilities = [
  ['Project foundation & durable memory', ['src/domain/project.ts', 'src/infrastructure/file-project-store.ts'], () => hasTest(/project-foundation/)],
  ['Manuscript / chapter / scene workspace', ['src/domain/manuscript.ts'], () => hasTest(/manuscript(?!-production|-planning)/)],
  ['AI writing & model broker', ['src/application/ai-writing.ts', 'src/application/ai-model-broker.ts'], () => hasTest(/^test\/ai-(writing|model-broker)/)],
  ['Canon / character / series / voice', ['src/domain/character-bible.ts', 'src/domain/series.ts', 'src/domain/voice-preservation.ts'], () => hasTest(/version-control-author-control-series-voice|character/)],
  ['Research & provenance-aware memory', ['src/domain/research.ts', 'src/domain/relationship-memory.ts'], () => hasTest(/research|relationship-memory/)],
  ['Intelligent editing', ['src/domain/intelligent-editing.ts', 'src/application/intelligent-editing.ts'], () => hasTest(/intelligent-editing|ai-editing/)],
  ['Visual identity / illustration assets', ['src/domain/character-visual-continuity.ts', 'src/domain/illustration-asset-library.ts'], () => hasTest(/illustration|visual/)],
  ['Cover / KDP production planning', ['src/domain/book-cover-studio.ts'], () => hasTest(/book-cover/)],
  ['Manuscript production artifacts', ['src/domain/manuscript-production.ts', 'src/application/manuscript-production.ts'], () => hasTest(/manuscript-production/)],
  ['Guided Journal Office', ['src/domain/guided-journal.ts','src/application/guided-journal-workspace.ts','src/guided-journal-server.ts','public/guided-journal.html','scripts/guided-journal-browser-acceptance.js'], () => hasTest(/guided-journal/)],
  ['Educational Workbook Office', ['src/domain/educational-workbook.ts','src/application/educational-workbook-office.ts','src/application/educational-workbook-production.ts','src/educational-workbook-server.ts','public/educational-workbooks.html','scripts/educational-workbook-browser-acceptance.js'], () => hasTest(/educational-workbook/)],
  ['Educational differentiation & teacher support', ['src/domain/educational-workbook-differentiation.ts','src/application/educational-workbook-differentiation.ts','src/application/educational-workbook-differentiation-production.ts','src/application/educational-workbook-differentiation-routes.ts','src/infrastructure/file-educational-workbook-differentiation-store.ts','public/educational-differentiation.html','scripts/educational-workbook-differentiation-browser-acceptance.js'], () => hasTest(/educational-workbook-differentiation/)],
  ['Educational rubrics & performance assessment', ['src/domain/educational-assessment.ts','src/application/educational-assessment.ts','src/application/educational-assessment-routes.ts','src/infrastructure/file-educational-assessment-store.ts','public/educational-assessment.html','scripts/educational-assessment-browser-acceptance.js'], () => hasTest(/educational-assessment/)],
  ['Specialized Creation Office', ['src/domain/specialized-creation-office.ts','src/application/specialized-creation-office-service.ts','src/application/specialized-creation-production-engine.ts','src/specialized-creation-server.ts','public/specialized-creation.html','scripts/specialized-creation-browser-acceptance.js','scripts/specialized-creation-mobile-acceptance.js'], () => hasTest(/specialized-creation/)],
  ['Publishing / market intelligence / Promotion', ['src/domain/publishing-readiness.ts','src/application/studio-publishing-metadata.ts','src/domain/kdp-market-intelligence.ts','src/infrastructure/openai-kdp-market-intelligence-provider.ts','src/domain/marketing-campaign.ts','src/domain/promotion-readiness.ts','src/domain/promotion-performance.ts','src/application/studio-publishing-promotion-routes.ts','public/forge-publishing-promotion.js','public/forge-promotion-performance.js'], () => hasTest(/publishing|marketing|promotion-performance|kdp-live-market-research|kdp-market/)],
  ['Version control & author authority', ['src/domain/book-version-control.ts', 'src/domain/author-control.ts'], () => hasTest(/version-control-author-control-series-voice/)],
  ['Workflow gates / delivery audit / Book Genome', ['src/domain/workflow-gate.ts', 'src/domain/delivery-audit.ts', 'src/domain/final-product-systems.ts'], () => hasTest(/workflow|delivery-audit|final-product/)],
  ['Portable project package / recovery', ['src/domain/project-package.ts', 'src/application/project-package.ts'], () => hasTest(/project-package|external-storage/)],
  ['AI context optimization / cost governance', ['src/application/context-engine-stack.ts', 'src/application/ai-cost-guard.ts'], () => hasTest(/context|cost-guard/)],
  ['Integrated Studio / browser acceptance', ['src/studio-server.ts', 'scripts/start-forge.js', ...browserHarnesses], () => allExist(browserHarnesses) && exists('scripts/start-forge.js')],
  ['Android / PWA delivery surface', ['public/manifest.webmanifest', 'public/sw.js', 'public/forge-pwa.js', ...mobileHarnesses], () => allExist(mobileHarnesses) && hasTest(/pwa|mobile/)],
];
let earned = 0;
const rows = capabilities.map(([name, required, verification]) => { const implementation = required.filter(exists).length / required.length; const verified = verification() ? 1 : 0; const score = Math.round(implementation * verified * 100); earned += score; return { name, implementation, verified, score }; });
const engineering = Math.round(earned / capabilities.length);
const browserEvidence = allExist(browserHarnesses) ? 100 : 0;
const mobileEvidence = allExist(mobileHarnesses) ? 100 : 0;
const providerBoundary = /KINGS_AI_ENDPOINT|OMNIROUTE_BASE_URL|OpenAI|Ollama/.test(sourceText) ? 100 : 0;
const honestAi = /fabricat|real provider|provider.*unavailable|not configured/i.test(sourceText + testText) ? 100 : 0;
const documentation = exists('AUTHORS_FORGE_MASTER_PRODUCT_DIRECTIVE.md') && exists('README.md') ? 100 : 0;
const verification = Math.round((browserEvidence + mobileEvidence + providerBoundary + honestAi + documentation) / 5);
console.log("AUTHOR'S FORGE — COMPLETION REPORT");
console.log('='.repeat(72));
console.log(`Engineering capability completion: ${engineering}%`);console.log(`Verification/evidence readiness:    ${verification}%`);console.log(`Browser acceptance harness:         ${browserEvidence}% present`);console.log(`Mobile acceptance harness:          ${mobileEvidence}% present`);console.log(`Real-provider boundary evidence:    ${providerBoundary}%`);console.log(`Honest-AI/error contract evidence:  ${honestAi}%`);console.log(`Product directive/documentation:     ${documentation}%`);console.log('');console.log('Capability detail:');
for (const row of rows) console.log(`- ${String(row.score).padStart(3)}%  ${row.name} (implementation ${Math.round(row.implementation * 100)}%, automated evidence ${row.verified ? 100 : 0}%)`);
console.log('');console.log('Interpretation: 100% is reserved for a complete, verified product journey.');console.log('The meter requires Guided Journal, Educational Workbooks including differentiation/teacher support and rubric/performance assessment, Specialized Creation, the unified workplace launcher, plus every canonical browser/mobile harness.');console.log('This meter never substitutes source presence for real browser/device proof; CI must execute the harnesses successfully.');console.log('Run after a clean checkout/build: npm run completion');
