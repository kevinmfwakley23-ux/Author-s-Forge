const test = require("node:test");
const assert = require("node:assert/strict");
const forge = require("../.forge-build/index.js");

const requiredFunctions = [
  "createManuscriptState", "createBook", "createChapter", "createScene",
  "createProject", "createProjectPackage", "createPublishingReadinessReport",
  "createBookSnapshot", "createSeries", "createVoiceProfile", "analyzeVoice",
  "createAiCollaborationPolicy", "createProjectHealthReport", "createMemoryRelationship",
  "createDeliveryAuditReport", "advanceProjectWorkflow", "AiWritingCoordinator",
  "AiWritingStudioService", "AiEditingProposalService", "AiModelBroker"
];

const requiredConstructors = ["FileProjectStore", "AuthorControlService"];

test("public Forge API exports all canonical domain and application capabilities", () => {
  for (const name of requiredFunctions) assert.equal(typeof forge[name], "function", `${name} must be exported as a function`);
  for (const name of requiredConstructors) assert.equal(typeof forge[name], "function", `${name} must be exported as a constructor`);
});
