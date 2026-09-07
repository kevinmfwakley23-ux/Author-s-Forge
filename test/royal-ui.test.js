const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

const read = (path) => readFileSync(path, "utf8");

test("royal UI shell is valid JavaScript and loaded only through the main Studio extension gate", () => {
  const ui = read("public/forge-royal-ui.js");
  const pwa = read("public/forge-pwa.js");
  assert.doesNotThrow(() => new vm.Script(ui, { filename: "forge-royal-ui.js" }));
  assert.doesNotThrow(() => new vm.Script(pwa, { filename: "forge-pwa.js" }));
  assert.match(pwa, /function isMainStudio\(\)\{return Boolean\(document\.getElementById\("dashboard"\)\);\}/);
  assert.match(pwa, /function ensureStudioExtensions\(\)\{if\(!isMainStudio\(\)\)return;/);
  assert.match(pwa, /loadExtension\("royal-ui","\/forge-royal-ui\.js"\)/);
  assert.match(pwa, /function ensureRoyalHardeningStyles\(\)\{if\(!isMainStudio\(\)/);
});

test("main Studio launcher contains only main writing-production tools and no optional offices", () => {
  const pwa = read("public/forge-pwa.js");
  assert.match(pwa, /Main Studio tools/);
  for (const tool of ["Agent Workbench", "Design & Motion", "Series Engine"]) assert.match(pwa, new RegExp(tool));
  for (const forbidden of ["open-guided-journal-office", "open-workbook-office", "open-specialized-office", "open-nft-office", "HOSTED_PORT_PATHS", "officeUrl\("]) {
    assert.doesNotMatch(pwa, new RegExp(forbidden));
  }
});

test("optional offices cannot inherit the main white-marble royal skin", () => {
  const sharedOfficeCss = read("public/forge-office-royal.css");
  const sharedOfficeJs = read("public/forge-office-royal.js");
  const journalCss = read("public/guided-journal-royal.css");
  const journalJs = read("public/guided-journal-royal.js");
  const specializedCss = read("public/specialized-creation-royal.css");
  for (const source of [sharedOfficeCss, journalCss, specializedCss]) {
    assert.match(source, /main .*Studio|main K\.I\.N\.G\.S\. Author's Forge Studio/i);
    assert.doesNotMatch(source, /linear-gradient|radial-gradient|--office-gold|--sc-royal-gold/);
  }
  for (const source of [sharedOfficeJs, journalJs]) {
    assert.match(source, /Compatibility no-op/);
    assert.doesNotMatch(source, /localStorage\.setItem\(|forge-office-theme|dataset\.forgeTheme/);
  }
});

test("royal UI is part of the versioned offline shell", () => {
  const worker = read("public/sw.js");
  assert.match(worker, /authors-forge-shell-v\d+/);
  assert.match(worker, /"\/forge-royal-ui\.js"/);
  assert.match(worker, /"\/forge-royal-hardening\.css"/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
});

test("royal UI supports persistent light and dark themes inside main Studio", () => {
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
  assert.match(css, /@media\(max-width:1100px\)/);
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
  assert.match(hardening, /forge-studio-tool-link/);
  assert.doesNotMatch(hardening, /forge-office-link/);
});

test("K.I.N.G.S. Author's Forge branding and family brain gospel cannot silently drift", () => {
  const ui = read("public/forge-royal-ui.js");
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  const readme = read("README.md");
  const gospel = read("docs/KINGS_FAMILY_ARCHITECTURE_GOSPEL.md");
  const definition = "KNOWLEDGE • INVESTIGATION • NARRATIVE • GENERATION • SYSTEM";

  assert.match(ui, /K\.I\.N\.G\.S\. AUTHOR'S FORGE/);
  assert.match(ui, new RegExp(definition));
  assert.equal(manifest.name, "K.I.N.G.S. Author's Forge");
  assert.match(manifest.description, new RegExp(definition));
  assert.match(readme, /Architecture Gospel — LOCKED/);
  assert.match(readme, /must \*\*not require the separate K\.I\.N\.G\.S\. AI application to be online\*\*/);
  assert.match(readme, /last-resort\/offline\/local fallback/);
  assert.match(gospel, new RegExp(definition));
  assert.match(gospel, /OmniRoute integration/);
  assert.match(gospel, /9Router integration/);
});
