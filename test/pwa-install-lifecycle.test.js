const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const pwa = fs.readFileSync('public/forge-pwa.js', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));

test('PWA lifecycle exposes a real install prompt boundary and app-installed state', () => {
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /prompt\(\)/);
  assert.match(pwa, /userChoice/);
  assert.match(pwa, /appinstalled/);
  assert.match(pwa, /serviceWorker\.register\("\/sw\.js"/);
  assert.match(pwa, /id = "install-forge"/);
  assert.match(pwa, /Install Forge/);
});

test('PWA lifecycle does not persist project data in browser storage', () => {
  assert.doesNotMatch(pwa, /localStorage|sessionStorage|indexedDB/);
  assert.match(pwa, /setStatus/);
});

test('service worker upgrades safely and excludes API project state from caching', () => {
  assert.match(sw, /const CACHE = "authors-forge-shell-v\d+"/);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(sw, /request\.method !== "GET"/);
});

test('manifest declares Android-installable standalone behavior', () => {
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.start_url, '/?project=forge-studio');
  assert.equal(manifest.icons.length >= 2, true);
});
