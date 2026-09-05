const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');
const pwa = fs.readFileSync('public/forge-pwa.js', 'utf8');
const launcherIcon = fs.readFileSync('public/icon-192.svg', 'utf8');
const series = fs.readFileSync('public/series.html', 'utf8');
const styles = fs.readFileSync('public/styles.css', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
const platformContract = fs.readFileSync('docs/PLATFORM_SUPPORT.md', 'utf8');

test('PWA shell has a platform-neutral install manifest and live lifecycle entrypoint', () => {
  assert.equal(manifest.name, "Author's Forge");
  assert.equal(manifest.id, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.start_url, '/', 'launcher must reopen Forge without forcing a different project than the last active project');
  assert.equal(manifest.prefer_related_applications, false);
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);
  const iconSizes = new Set(manifest.icons.map((icon) => icon.sizes));
  assert.ok(iconSizes.has('192x192'), 'manifest must expose a 192x192 install icon');
  assert.ok(iconSizes.has('512x512'), 'manifest must expose a 512x512 install icon');
  assert.ok(manifest.icons.some((icon) => icon.type === 'image/png' && icon.sizes === '192x192'), 'Android must have a raster 192 icon fallback');
  assert.ok(manifest.icons.some((icon) => icon.type === 'image/png' && icon.sizes === '512x512'), 'Android must have a raster 512 icon fallback');
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'), 'Android must have an adaptive maskable launcher icon');
  assert.ok(fs.existsSync('public/icon-192.png'), 'build must generate the 192px Android launcher PNG');
  assert.ok(fs.existsSync('public/icon-512.png'), 'build must generate the 512px Android launcher PNG');
  assert.ok(fs.existsSync('public/icon-maskable-512.png'), 'build must generate the maskable Android launcher PNG');
  for (const file of ['public/icon-192.png', 'public/icon-512.png', 'public/icon-maskable-512.png']) {
    assert.deepEqual([...fs.readFileSync(file).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${file} must be a real PNG`);
  }
  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 4, 'installed Forge must expose Android launcher shortcuts');
  assert.deepEqual(manifest.shortcuts.map((shortcut) => shortcut.url), ['/forge-agent.html', '/forge-media-studio.html', '/series.html', '/#writing'], 'launcher shortcuts must work on both local and hosted Forge and preserve the active project');
  assert.match(index, /manifest\.webmanifest/);
  assert.match(index, /forge-pwa\.js/, 'Main Studio must actually load the PWA lifecycle it claims to ship');
  assert.match(pwa, /hostedMode\(\)\?"\/sw-hosted\.js":"\/sw\.js"/);
  assert.match(pwa, /serviceWorker\.register\(script/);
});

test('Android install experience is a real round launcher rather than a browser-only instruction', () => {
  assert.match(pwa, /forge-android-install-fab/);
  assert.match(pwa, /width:68px;height:68px;border-radius:999px/);
  assert.match(pwa, /Install Author's Forge on this Android device/);
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /appinstalled/);
  assert.match(pwa, /Add to Home screen/);
  assert.match(launcherIcon, /<circle/);
  assert.match(launcherIcon, /#d4ad63/);
  assert.match(serviceWorker, /"\/icon-maskable-512\.png"/);
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
  assert.match(styles, /@media\(max-width:1100px\)/);
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
