import test from "node:test";
import assert from "node:assert/strict";
import * as forge from "../dist/index.js";

const REQUIRED_FUNCTION_EXPORTS = [
  "createProject",
  "createManuscriptState",
  "createBook",
  "createChapter",
  "createScene",
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
];

const REQUIRED_CONSTRUCTOR_EXPORTS = [
  "FileProjectStore",
  "FileVisualIdentityStore",
  "ManuscriptPlanningService",
  "IntelligentEditingService",
  "CharacterBibleService",
  "CharacterVisualContinuityService",
  "IllustrationAssetLibraryService",
  "BookCoverStudioService",
  "ManuscriptProductionService",
  "PublishingReadinessService",
  "ProjectPackageService",
  "ExternalStorageService",
  "AuthorControlService",
  "SeriesService",
  "VoicePreservationService",
  "AiCollaborationService",
  "ProjectHealthService",
  "RelationshipMemoryService",
];

test("compiled Forge public API exposes the canonical function surface", () => {
  for (const name of REQUIRED_FUNCTION_EXPORTS) {
    assert.equal(typeof forge[name], "function", `${name} must be a function export from dist/index.js`);
  }
});

test("compiled Forge public API exposes the canonical service constructors", () => {
  for (const name of REQUIRED_CONSTRUCTOR_EXPORTS) {
    assert.equal(typeof forge[name], "function", `${name} must be a constructor export from dist/index.js`);
  }
});

test("compiled Forge public API contains no accidental undefined canonical exports", () => {
  const required = [...REQUIRED_FUNCTION_EXPORTS, ...REQUIRED_CONSTRUCTOR_EXPORTS];
  const missing = required.filter((name) => !(name in forge));
  assert.deepEqual(missing, []);
});
