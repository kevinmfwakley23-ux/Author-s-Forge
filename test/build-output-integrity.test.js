const test = require("node:test");
const assert = require("node:assert/strict");

const sourceBuild = require("../.forge-build/index.js");
const runtimeBuild = require("../dist/index.js");

const requiredExports = [
  "createManuscriptState",
  "createBook",
  "createChapter",
  "createScene",
  "createProject",
  "FileProjectStore",
  "createProjectPackage",
  "createPublishingReadinessReport",
  "createBookSnapshot",
  "createSeries",
  "createVoiceProfile",
  "analyzeVoice",
  "createAiCollaborationPolicy",
  "createProjectHealthReport",
  "createMemoryRelationship",
  "createDeliveryAuditReport",
  "advanceProjectWorkflow",
  "AuthorControlService"
];

test("runtime dist build preserves the canonical Forge public API", () => {
  for (const name of requiredExports) {
    assert.equal(typeof sourceBuild[name], "function", `${name} must exist in .forge-build`);
    assert.equal(typeof runtimeBuild[name], "function", `${name} must exist in dist`);
  }
});

test("runtime dist and canonical build expose the same public export names", () => {
  const sourceNames = Object.keys(sourceBuild).sort();
  const runtimeNames = Object.keys(runtimeBuild).sort();
  assert.deepEqual(runtimeNames, sourceNames);
});
