const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');
const pwa = fs.readFileSync('public/forge-pwa.js', 'utf8');
const series = fs.readFileSync('public/series.html', 'utf8');
const styles = fs.readFileSync('public/styles.css', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
const platformContract = fs.readFileSync('docs/PLATFORM_SUPPORT.md', 'utf8');

test('PWA shell has a platform-neutral install manifest and live lifecycle entrypoint', () => {
  assert.equal(manifest.name, "Author's Forge");
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.start_url, '/?project=forge-studio');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  const iconSizes = new Set(manifest.icons.map((icon) => icon.sizes));
  assert.ok(iconSizes.has('192x192'), 'manifest must expose a 192x192 install icon');
  assert.ok(iconSizes.has('512x512'), 'manifest must expose a 512x512 install icon');
  for (const icon of manifest.icons) assert.equal(typeof icon.src, 'string');
  assert.match(index, /manifest\.webmanifest/);
  assert.match(index, /forge-pwa\.js/, 'Main Studio must actually load the PWA lifecycle it claims to ship');
  assert.match(pwa, /serviceWorker\.register\("\/sw\.js"/);
});

test('Series Engine is discoverable from the live Studio PWA and travels in the offline shell', () => {
  assert.match(pwa, /open-series-engine/);
  assert.match(pwa, /series\.html/);
  assert.match(serviceWorker, /"\/series\.html"/);
  assert.match(serviceWorker, /"\/forge-series\.js"/);
  assert.match(serviceWorker, /caches\.match\(url\.pathname\)/, 'offline project-query navigation must resolve the cached Series shell by pathname');
  assert.match(series, /manifest\.webmanifest/);
  assert.match(series, /forge-pwa\.js/);
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
  assert.match(series, /viewport-fit=cover/);
});

test('platform contract keeps future native environments behind shared boundaries', () => {
  assert.match(platformContract, /Asus Chromebook/);
  assert.match(platformContract, /Android phone/);
  assert.match(platformContract, /platform-neutral/);
  assert.match(platformContract, /portable project package/);
});
