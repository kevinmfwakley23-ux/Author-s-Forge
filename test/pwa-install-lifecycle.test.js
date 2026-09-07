const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pwa = fs.readFileSync('public/forge-pwa.js', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));

test('PWA lifecycle exposes a real install prompt boundary and app-installed state',()=>{assert.match(pwa,/beforeinstallprompt/);assert.match(pwa,/prompt\(\)/);assert.match(pwa,/userChoice/);assert.match(pwa,/appinstalled/);assert.match(pwa,/hostedMode\(\)\?"\/sw-hosted\.js":"\/sw\.js"/);assert.match(pwa,/serviceWorker\.register\(script/);assert.match(pwa,/id="?install-forge"?|id = "install-forge"/);assert.match(pwa,/Install Forge/)});
test('PWA lifecycle does not persist project data in browser storage',()=>{assert.doesNotMatch(pwa,/localStorage\.setItem|sessionStorage\.setItem|indexedDB/i);assert.match(pwa,/setStatus/)});
test('PWA exposes only project-aware touch-sized main Studio tool links',()=>{assert.match(pwa,/function isMainStudio\(\)/);assert.match(pwa,/Main Studio tools/);assert.match(pwa,/forge-agent\.html/);assert.match(pwa,/forge-media-studio\.html/);assert.match(pwa,/series\.html/);assert.match(pwa,/forge-studio-tool-link/);assert.match(pwa,/minHeight:"44px"|minHeight: "44px"/);for(const forbidden of ['open-guided-journal-office','open-workbook-office','open-workbook-differentiation','open-workbook-assessment','open-specialized-office','open-nft-office','educational-differentiation.html','educational-assessment.html'])assert.equal(pwa.includes(forbidden),false,`${forbidden} must stay outside the main Studio PWA`)});
test('PWA loads and caches the durable Image Lab extension without caching API state',()=>{assert.match(pwa,/forge-image-lab\.js/);assert.match(pwa,/data-forge-extension|dataset\.forgeExtension/);assert.match(sw,/\/forge-image-lab\.js/);assert.match(sw,/const CACHE = "authors-forge-shell-v\d+"/);assert.match(sw,/SKIP_WAITING/);assert.match(sw,/url\.pathname\.startsWith\("\/api\/"\)/);assert.match(sw,/request\.method !== "GET"/)});
test('manifest declares Android-installable standalone behavior',()=>{assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'any');assert.equal(manifest.start_url,'/');assert.equal(manifest.icons.length>=2,true)});
