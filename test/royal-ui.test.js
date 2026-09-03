const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

const read = (path) => readFileSync(path, "utf8");

test("royal UI shell is valid JavaScript and loaded by the Studio PWA", () => {
  const ui = read("public/forge-royal-ui.js");
  const pwa = read("public/forge-pwa.js");
  assert.doesNotThrow(() => new vm.Script(ui, { filename: "forge-royal-ui.js" }));
  assert.match(pwa, /loadExtension\("royal-ui","\/forge-royal-ui\.js"\)/);
});

test("royal UI supports persistent light and dark themes", () => {
  const ui = read("public/forge-royal-ui.js");
  const css = read("public/styles.css");
  assert.match(ui, /forge-theme/);
  assert.match(ui, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(ui, /forge-theme-toggle/);
  assert.match(css, /data-forge-theme="dark"/);
  assert.match(css, /\.forge-theme-toggle/);
});

test("forged-work shelf is driven by real workspace books rather than sample titles", () => {
  const ui = read("public/forge-royal-ui.js");
  assert.match(ui, /workspace\?\.books/);
  assert.match(ui, /forge:workspace-ready/);
  assert.match(ui, /possibleCover\(book\)/);
  assert.doesNotMatch(ui, /Heir of Dusk|Ashes of Empires|Silent Throne/);
});

test("approved current-project panel is bound to the real active book", () => {
  const ui = read("public/forge-royal-ui.js");
  assert.match(ui, /workspace\?\.activeBookId/);
  assert.match(ui, /renderCurrentProject\(workspace\)/);
  assert.match(ui, /buttons\[0\]\.dataset\.route = "writing"/);
  assert.match(ui, /Continue Forging/);
  assert.match(ui, /buttons\[1\]\.dataset\.route = "health"/);
});

test("royal navigation keeps every canonical route while organizing the approved wings", () => {
  const ui = read("public/forge-royal-ui.js");
  for (const route of ["dashboard", "manuscript", "writing", "architecture", "characters", "world", "research", "editing", "voice", "art", "cover", "publishing", "marketing", "genome", "health", "versions", "settings", "governance"]) {
    assert.match(ui, new RegExp(`"${route}"`));
  }
  for (const wing of ["CREATE", "WORLD & CANON", "REFINE", "VISUALS", "PUBLISH", "PROMOTE", "VAULT"]) assert.match(ui, new RegExp(wing));
});

test("royal UI preserves existing route controls and mobile-responsive presentation", () => {
  const ui = read("public/forge-royal-ui.js");
  const css = read("public/styles.css");
  assert.match(ui, /querySelectorAll\("a\[data-route\]"\)/);
  assert.doesNotMatch(ui, /remove\(\).*data-route|\.hidden\s*=\s*true/);
  assert.match(css, /@media\(max-width:1000px\)/);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
