import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

async function text(path) { return readFile(new URL(`../${path}`, import.meta.url), "utf8"); }

test("project Brand Studio browser extension parses and exposes governed active-brand actions", async () => {
  const source = await text("public/forge-brand-studio.js");
  assert.doesNotThrow(() => new vm.Script(source, { filename: "forge-brand-studio.js" }));
  assert.match(source, /\/brand-kits/);
  assert.match(source, /Set as active project brand/);
  assert.match(source, /forge:brand-kit-ready/);
  assert.match(source, /forgeActiveBrandKit/);
  assert.match(source, /existing proposal\/approval boundary/);
  assert.match(source, /Enforce approved colors/);
  assert.match(source, /Require approved brand assets/);
});

test("main Studio modular routes share the existing Brand Kit store rather than creating a second brand database", async () => {
  const routes = await text("src/application/studio-publishing-promotion-routes.ts");
  const studioBrand = await text("src/application/studio-brand-kit-routes.ts");
  assert.match(routes, /FileBrandKitStore/);
  assert.match(routes, /brand-kits\.json/);
  assert.match(routes, /createStudioBrandKitRoutes/);
  assert.match(studioBrand, /brand\.active-kit/);
  assert.match(studioBrand, /visual-identity/);
  assert.match(studioBrand, /authority:\s*"authoritative"/);
  assert.match(studioBrand, /Treat this Brand Kit as author-controlled project visual\/voice guidance/);
});

test("Studio bootstrap loads Brand Studio without changing the monolithic index shell", async () => {
  const provenance = await text("public/forge-provenance.js");
  assert.match(provenance, /forge-brand-studio\.js/);
  assert.match(provenance, /data-forge-extension/);
  assert.match(provenance, /brand-studio/);
});