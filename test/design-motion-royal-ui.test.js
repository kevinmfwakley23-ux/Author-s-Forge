const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

const html = read('public/forge-media-studio.html');
const js = read('public/forge-media-studio.js');
const css = read('public/forge-media-studio.css');
const pwa = read('public/forge-pwa.js');
const sw = read('public/sw.js');
const specializedRoyal = read('public/specialized-creation-royal.css');
const officeRoyal = read('public/forge-office-royal.css');
const officeRoyalJs = read('public/forge-office-royal.js');
const journalRoyal = read('public/guided-journal-royal.css');
const journalRoyalJs = read('public/guided-journal-royal.js');
const journalHtml = read('public/guided-journal.html');
const workbookHtml = read('public/educational-workbooks.html');
const differentiationHtml = read('public/educational-differentiation.html');
const assessmentHtml = read('public/educational-assessment.html');
const nftHtml = read('public/nft-creation.html');
const nftDirector = read('public/nft-production-director.js');

test('Design & Motion exposes all six requested first-class tools', () => {
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

test('Design & Motion remains an integrated main Studio production tool', () => {
  assert.match(pwa, /forge-media-studio\.html/);
  assert.match(sw, /forge-media-studio\.html/);
  assert.match(sw, /forge-media-studio\.js/);
  assert.match(sw, /forge-media-studio\.css/);
});

test('optional standalone offices do not receive the main Studio royal marble layer', () => {
  for (const source of [specializedRoyal, officeRoyal, journalRoyal]) {
    assert.match(source, /main .*Studio|main K\.I\.N\.G\.S\. Author's Forge Studio/i);
    assert.doesNotMatch(source, /linear-gradient|radial-gradient|--office-gold|--sc-royal-gold|Cinzel/);
  }
  for (const source of [officeRoyalJs, journalRoyalJs]) {
    assert.match(source, /Compatibility no-op/);
    assert.doesNotMatch(source, /forge-office-theme|localStorage\.setItem\(|dataset\.forgeTheme/);
  }
});

test('legacy standalone office pages remain parseable/available without owning Forge marble presentation', () => {
  assert.match(journalHtml, /guided-journal-royal\.css/);
  for (const page of [workbookHtml, differentiationHtml, assessmentHtml]) assert.match(page, /forge-office-royal\.css/);
  assert.match(nftHtml, /nft-production-director\.js/);
  assert.match(nftDirector, /Series \/ Set Director|Series & Sets/);
  assert.match(nftDirector, /Market Signals/);
  assert.match(nftDirector, /Storage & Provenance/);
});
