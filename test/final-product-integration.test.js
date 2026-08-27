const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createBookGenome,
  identifyGenomeImpact,
  createCapabilityGap,
  advanceCapabilityGap,
  defaultOwnershipPolicy,
  createVoiceCommand,
  createCreativeProvenance,
  createFinalProductAudit,
  FINAL_DELIVERY_AUDIT_CATEGORIES,
} = require("../dist");

test("final product systems enforce Book Genome downstream impact and author approval", () => {
  const genome = createBookGenome({
    projectId: "project-001",
    nodes: [
      { id: "canon-1", component: "canon", label: "Opening setting", references: [], metadata: {} },
      { id: "character-1", component: "characters", label: "Marcus", references: ["canon-1"], metadata: {} },
      { id: "scene-1", component: "scenes", label: "Chapter 4 scene", references: ["character-1", "canon-1"], metadata: {} },
      { id: "art-1", component: "art", label: "Chapter 4 illustration", references: ["scene-1"], metadata: {} },
    ],
  });
  const impact = identifyGenomeImpact(genome, "canon-1");
  assert.deepEqual(impact.affectedNodeIds, ["character-1", "scene-1"]);
  assert.equal(impact.requiresAuthorApproval, true);
});

test("capability gaps use the K.I.N.G.S. escalation lifecycle", () => {
  let gap = createCapabilityGap({ id: "gap-1", projectId: "project-001", capability: "advanced illustration consistency", reason: "Current Forge providers cannot satisfy the required consistency boundary." });
  assert.equal(gap.authority, "kings");
  for (const [status, note] of [["researching", "Research required."], ["planned", "Plan verified."], ["building", "Implementation authorized."], ["testing", "Build complete."], ["verified", "Acceptance verification passed."]]) gap = advanceCapabilityGap(gap, status, note);
  assert.equal(gap.status, "verified");
});

test("governance keeps external uploads explicit and the original voice transcript durable", () => {
  const policy = defaultOwnershipPolicy();
  assert.equal(policy.silentExternalUploads, false);
  assert.equal(policy.localFirst, true);
  const voice = createVoiceCommand({ id: "voice-1", projectId: "project-001", transcript: "Start Chapter 14 with Marcus driving through Ogden in a snowstorm.", intent: "create-scene-opening" });
  assert.equal(voice.originalPreserved, true);
  assert.equal(voice.transcript.includes("Marcus"), true);
  assert.throws(() => createCreativeProvenance({ id: "p-1", projectId: "project-001", artifactId: "image-1", kind: "real-person", source: "uploaded-photo", consentStatus: "pending" }), /Consent must be granted/);
});

test("final delivery audit requires the complete 13-category boundary", () => {
  const checks = FINAL_DELIVERY_AUDIT_CATEGORIES.map((category) => ({ category, passed: true, message: "Verified.", blocking: false }));
  const report = createFinalProductAudit({ id: "audit-1", projectId: "project-001", checks });
  assert.equal(report.passed, 13);
  assert.equal(report.attention, 0);
  assert.equal(report.status, "ready-for-author-approval");
});

test("Forge Studio is a real route-driven application surface", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  for (const route of ["dashboard", "manuscript", "characters", "world", "art", "research", "marketing", "publishing", "genome", "governance"]) assert.match(html, new RegExp(`data-route=\\"${route}\\"`));
  assert.match(app, /function navigate\(route\)/);
  assert.match(app, /fetch\(path/);
  assert.match(app, /\/api\/projects\//);
});
