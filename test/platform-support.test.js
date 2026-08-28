const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');
const styles = fs.readFileSync('public/styles.css', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
const platformContract = fs.readFileSync('docs/PLATFORM_SUPPORT.md', 'utf8');

test('PWA shell has a platform-neutral install manifest', () => {
  assert.equal(manifest.name, "Author's Forge");
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.start_url, '/?project=forge-studio');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  assert.match(index, /manifest\.webmanifest/);
});

test('offline shell never treats API responses as cacheable project state', () => {
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(serviceWorker, /if \(request\.method !== "GET"/);
  assert.match(serviceWorker, /caches\.match\(request\)/);
});

test('responsive UI has Chromebook and phone layout breakpoints', () => {
  assert.match(styles, /@media\(max-width:1000px\)/);
  assert.match(styles, /@media\(max-width:650px\)/);
  assert.match(styles, /grid-template-columns:1fr/);
  assert.match(index, /viewport-fit=cover/);
});

test('platform contract keeps future native environments behind shared boundaries', () => {
  assert.match(platformContract, /Asus Chromebook/);
  assert.match(platformContract, /Android phone/);
  assert.match(platformContract, /platform-neutral/);
  assert.match(platformContract, /portable project package/);
});
