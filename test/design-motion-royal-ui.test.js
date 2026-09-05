const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

const html = read('public/forge-media-studio.html');
const js = read('public/forge-media-studio.js');
const css = read('public/forge-media-studio.css');
const baseCss = read('public/styles.css');
const pwa = read('public/forge-pwa.js');
const sw = read('public/sw.js');
const specialized = read('public/specialized-creation-api-state-sync.js');
const specializedRoyal = read('public/specialized-creation-royal.css');
const officeRoyal = read('public/forge-office-royal.css');
const officeRoyalJs = read('public/forge-office-royal.js');
const journalHtml = read('public/guided-journal.html');
const journalRoyal = read('public/guided-journal-royal.css');
const journalRoyalJs = read('public/guided-journal-royal.js');
const workbookHtml = read('public/educational-workbooks.html');
const differentiationHtml = read('public/educational-differentiation.html');
const assessmentHtml = read('public/educational-assessment.html');
const nftHtml = read('public/nft-creation.html');
const nftDirector = read('public/nft-production-director.js');

test('Design & Motion exposes all six requested first-class offices', () => {
  for (const mode of ['calendar', 'advertisement', 'daily-planner', 'meme', 'gif', 'stop-motion']) {
    assert.match(html, new RegExp(`data-mode=["']${mode}["']`));
    assert.match(js, new RegExp(`(?:["']${mode}["']|${mode}:)`));
  }
});

test('Design & Motion uses real artifact paths rather than fake download placeholders', () => {
  assert.match(js, /GIF89a/);
  assert.match(js, /MediaRecorder/);
  assert.match(js, /captureStream/);
  assert.match(js, /canvas\.toBlob/);
  assert.match(js, /application\/json/);
  assert.doesNotMatch(js, /TODO[^\n]*(fake|mock)|placeholder artifact/i);
});

test('Design & Motion is integrated into installed Forge shell', () => {
  assert.match(pwa, /forge-media-studio\.html/);
  assert.match(sw, /forge-media-studio\.html/);
  assert.match(sw, /forge-media-studio\.js/);
  assert.match(sw, /forge-media-studio\.css/);
});

test('new creative surfaces use the approved royal marble light-dark system', () => {
  // Design & Motion composes the canonical Studio token sheet rather than
  // duplicating a second dark-theme palette inside its office-local CSS.
  assert.match(html, /href="\/styles\.css"/);
  assert.match(html, /forge-royal-hardening\.css/);
  assert.match(baseCss, /:root\[data-forge-theme="dark"\]/);
  for (const token of ['--forge-bg', '--forge-panel', '--forge-ink', '--forge-muted', '--forge-gold']) assert.match(css, new RegExp(token));
  assert.match(js, /document\.documentElement\.dataset\.forgeTheme = next/);
  assert.match(js, /localStorage\.setItem\("forge-theme", next\)/);

  for (const source of [specializedRoyal, officeRoyal, journalRoyal]) {
    assert.match(source, /gold|#b68a3f|#c49345/i);
    assert.match(source, /data-forge-theme=["\\]?dark|data-forge-theme\\?="dark"/i);
  }
  assert.match(specialized, /specialized-creation-royal\.css/);
  assert.match(specialized, /forge-theme/);
  assert.match(officeRoyalJs, /forge-theme/);
  assert.match(officeRoyalJs, /Switch to/);
  assert.match(journalRoyalJs, /forge-theme/);
  assert.match(journalRoyalJs, /Switch to/);
});

test('standalone creation offices actually load the royal UI runtime', () => {
  assert.match(journalHtml, /guided-journal-royal\.css/);
  assert.match(journalHtml, /guided-journal-royal\.js/);
  for (const page of [workbookHtml, differentiationHtml, assessmentHtml]) {
    assert.match(page, /forge-office-royal\.css/);
    assert.match(page, /forge-office-royal\.js/);
  }
  assert.match(nftHtml, /forge-office-royal\.js/);
  assert.match(nftHtml, /nft-production-director\.js/);
  assert.match(nftDirector, /Series \/ Set Director|Series & Sets/);
  assert.match(nftDirector, /Market Signals/);
  assert.match(nftDirector, /Storage & Provenance/);
});
