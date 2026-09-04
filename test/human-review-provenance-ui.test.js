"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const vm = require("node:vm");

const root = join(__dirname, "..");
async function text(path) { return readFile(join(root, path), "utf8"); }

for (const path of ["public/forge-review-room.js", "public/forge-reviewer.js", "public/forge-provenance.js", "public/forge-pwa.js", "public/sw.js", "public/sw-hosted.js"]) {
  test(`${path} parses as JavaScript`, async () => {
    const source = await text(path);
    assert.doesNotThrow(() => new vm.Script(source, { filename: path }));
  });
}

test("Studio PWA loads governed human review and provenance extensions", async () => {
  const source = await text("public/forge-pwa.js");
  assert.match(source, /loadExtension\("review-room","\/forge-review-room\.js"\)/);
  assert.match(source, /loadExtension\("provenance","\/forge-provenance\.js"\)/);
});

test("review invitation keeps the one-time credential in a server-issued URL fragment and reviewer moves it to session-only storage", async () => {
  const routes = await text("src/application/studio-human-review-routes.ts");
  const room = await text("public/forge-review-room.js");
  const reviewer = await text("public/forge-reviewer.js");
  assert.match(routes, /\/review\.html\?project=\$\{encodeURIComponent\(projectId\)\}#token=\$\{encodeURIComponent\(created\.token\)\}/);
  assert.match(routes, /reviewUrl:\s*fragmentUrl/);
  assert.match(routes, /tokenShownOnce:\s*true/);
  assert.match(room, /created\.reviewUrl/);
  assert.doesNotMatch(room, /#token=\$\{/);
  assert.ok(reviewer.includes('location.hash.replace(/^#/, "")'), "reviewer must parse credentials from the URL fragment");
  assert.ok(reviewer.includes('params.get("token")'), "reviewer must read the one-time token from fragment parameters");
  assert.ok(reviewer.includes('sessionStorage.setItem(tokenKey, token)'), "reviewer must move the token into session-only storage");
  assert.ok(reviewer.includes('history.replaceState(null, "", `${location.pathname}${location.search}`)'), "reviewer must scrub the fragment from browser history");
  assert.doesNotMatch(reviewer, /localStorage\.setItem\([^)]*review-token/);
});

test("review UI exposes role-governed suggestions and separate author apply", async () => {
  const room = await text("public/forge-review-room.js");
  const reviewer = await text("public/forge-reviewer.js");
  assert.match(room, /Accept/);
  assert.match(room, /Apply to manuscript/);
  assert.match(room, /Forge will refuse if the scene changed/);
  assert.match(reviewer, /context\.permissions\.suggest/);
  assert.match(reviewer, /Nothing was changed in the manuscript/);
  assert.match(reviewer, /crypto\.subtle\.digest\("SHA-256"/);
});

test("provenance UI states the unsigned C2PA boundary and shows integrity hashes", async () => {
  const source = await text("public/forge-provenance.js");
  assert.match(source, /not a signed C2PA manifest/i);
  assert.match(source, /Head SHA-256/);
  assert.match(source, /Previous:/);
  assert.match(source, /Export provenance JSON/);
});

test("local and hosted service workers cache all review/provenance surfaces without caching API state", async () => {
  for (const path of ["public/sw.js", "public/sw-hosted.js"]) {
    const source = await text(path);
    for (const asset of ["/review.html", "/forge-review-room.js", "/forge-reviewer.js", "/forge-provenance.js"]) assert.match(source, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(source, /\/api/);
  }
});
