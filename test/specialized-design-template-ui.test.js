"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const vm = require("node:vm");

const root = join(__dirname, "..");
const text = (path) => readFile(join(root, path), "utf8");

test("Specialized design template browser extension parses", async () => {
  const source = await text("public/specialized-design-templates.js");
  assert.doesNotThrow(() => new vm.Script(source, { filename: "specialized-design-templates.js" }));
});

test("Specialized state sync loads both Brand Kit and design-template governance extensions", async () => {
  const source = await text("public/specialized-creation-api-state-sync.js");
  assert.match(source, /specialized-brand-kit\.js/);
  assert.match(source, /specialized-design-templates\.js/);
  assert.match(source, /data-forge-extension="design-templates"/);
});

test("design-template UI remains preview-first and requires explicit author save", async () => {
  const source = await text("public/specialized-design-templates.js");
  assert.match(source, /Capture current design as template/);
  assert.match(source, /Preview editable copy/);
  assert.match(source, /propose-use/);
  assert.match(source, /Nothing has been saved yet/);
  assert.match(source, /Approve \+ save editable template copy/);
  assert.match(source, /confirm\(`Save \$\{lastCandidate\.template\.title\} as a new editable document and production profile/);
  assert.match(source, /\/profiles`/);
  assert.match(source, /\/documents`/);
});

test("design-template route captures from saved semantic documents and returns review-only candidates", async () => {
  const source = await text("src/application/specialized-design-template-routes.ts");
  assert.match(source, /captureSpecializedDesignTemplate/);
  assert.match(source, /instantiateSpecializedDesignTemplate/);
  assert.match(source, /sourceSpecializedProjectId/);
  assert.match(source, /sourceProject\.documents\.find/);
  assert.match(source, /sourceProject\.productionProfiles\.find/);
  assert.match(source, /persisted: false/);
  assert.match(source, /readyForAuthorReview/);
  assert.match(source, /auditBrandCompliance/);
  assert.match(source, /Persist only after explicit author approval/);
});

test("creative governance route hub wires durable design-template store without changing server shell", async () => {
  const source = await text("src/application/specialized-brand-kit-routes.ts");
  assert.match(source, /FileSpecializedDesignTemplateStore/);
  assert.match(source, /specialized-design-templates\.json/);
  assert.match(source, /createSpecializedDesignTemplateRoutes/);
  assert.match(source, /await designTemplateRoutes\(req, res, url, forgeProjectId\)/);
});
