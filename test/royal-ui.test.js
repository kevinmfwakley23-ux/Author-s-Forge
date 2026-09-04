const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

const read = (path) => readFileSync(path, "utf8");

test("royal UI shell is valid JavaScript and loaded by the Studio PWA", () => {
  const ui = read("public/forge-royal-ui.js");
  const pwa = read("public/forge-pwa.js");
  assert.doesNotThrow(() => new vm.Script(ui, { filename: "forge-royal-ui.js" }));
  assert.doesNotThrow(() => new vm.Script(pwa, { filename: "forge-pwa.js" }));
  assert.match(pwa, /loadExtension\("royal-ui","\/forge-royal-ui\.js"\)/);
  assert.match(pwa, /forge-royal-hardening\.css/);
});

test("royal UI is part of the versioned offline shell", () => {
  const worker = read("public/sw.js");
  assert.match(worker, /authors-forge-shell-v16/);
  assert.match(worker, /"\/forge-royal-ui\.js"/);
  assert.match(worker, /"\/forge-royal-hardening\.css"/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
});

test("royal UI supports persistent light and dark themes across Studio and Series Engine", () => {
  const ui = read("public/forge-royal-ui.js");
  const pwa = read("public/forge-pwa.js");
  const css = read("public/styles.css");
  assert.match(ui, /forge-theme/);
  assert.match(ui, /ensureThemeToggle\(\);\s*applyTheme\(currentTheme\(\), false\)/);
  assert.match(ui, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(ui, /forge-theme-toggle/);
  assert.match(pwa, /function applyStoredTheme\(\)/);
  assert.match(pwa, /document\.documentElement\.dataset\.forgeTheme=theme/);
  assert.match(css, /data-forge-theme="dark"/);
  assert.match(css, /\.forge-theme-toggle/);
});

test("forged-work shelf uses durable cover plans and renders the complete book collection", () => {
  const ui = read("public/forge-royal-ui.js");
  assert.match(ui, /workspace\?\.books/);
  assert.match(ui, /forge:workspace-ready/);
  assert.match(ui, /project\?\.bookCoverPlans/);
  assert.match(ui, /persisted\?\.artworkUri/);
  assert.match(ui, /\/api\/projects\//);
  assert.match(ui, /shelf\.innerHTML = books\.map/);
  assert.doesNotMatch(ui, /books\.slice\(0,\s*7\)/);
  assert.doesNotMatch(ui, /Heir of Dusk|Ashes of Empires|Silent Throne/);
});

test("workspace events without detail never erase a populated shelf", () => {
  const ui = read("public/forge-royal-ui.js");
  assert.match(ui, /const workspace = event\.detail \|\| window\.forgeWorkspaceState/);
  assert.match(ui, /if \(workspace\) renderShelf\(workspace\)/);
});

test("approved current-project panel is bound to the real active book", () => {
  const ui = read("public/forge-royal-ui.js");
  assert.match(ui, /workspace\?\.activeBookId/);
  assert.match(ui, /renderCurrentProject\(workspace\)/);
  assert.match(ui, /buttons\[0\]\.dataset\.route = "writing"/);
  assert.match(ui, /Continue Forging/);
  assert.match(ui, /buttons\[1\]\.dataset\.route = "health"/);
});

test("royal navigation keeps every canonical route including Story Map", () => {
  const ui = read("public/forge-royal-ui.js");
  for (const route of ["dashboard", "manuscript", "writing", "architecture", "story-map", "characters", "world", "research", "editing", "voice", "art", "cover", "publishing", "marketing", "genome", "health", "versions", "settings", "governance"]) {
    assert.match(ui, new RegExp(`"${route}"`));
  }
  assert.match(ui, /MutationObserver/);
  for (const wing of ["CREATE", "WORLD & CANON", "REFINE", "VISUALS", "PUBLISH", "PROMOTE", "VAULT"]) assert.match(ui, new RegExp(wing));
});

test("Android royal UI uses touch-safe compact navigation, safe areas, and zoom-safe inputs", () => {
  const ui = read("public/forge-royal-ui.js");
  const css = read("public/styles.css");
  const hardening = read("public/forge-royal-hardening.css");
  assert.match(ui, /querySelectorAll\("a\[data-route\]"\)/);
  assert.doesNotMatch(ui, /remove\(\).*data-route|\.hidden\s*=\s*true/);
  assert.match(css, /@media\(max-width:1000px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(hardening, /@media\(max-width:760px\)/);
  assert.match(hardening, /position:sticky/);
  assert.match(hardening, /overflow-x:auto/);
  assert.match(hardening, /min-height:44px/);
  assert.match(hardening, /env\(safe-area-inset-top\)/);
  assert.match(hardening, /env\(safe-area-inset-bottom\)/);
  assert.match(hardening, /select,input,textarea\{font-size:16px;min-height:44px\}/);
  assert.match(hardening, /\.editor\{min-height:54vh;font-size:16px\}/);
});

test("royal text and primary actions use high-contrast hardening tokens", () => {
  const hardening = read("public/forge-royal-hardening.css");
  assert.match(hardening, /--forge-faint:#665d50/);
  assert.match(hardening, /--forge-faint:#b8aa95/);
  assert.match(hardening, /--forge-gold-deep:#d5b06c/);
  assert.match(hardening, /color:#1b140b!important/);
});
