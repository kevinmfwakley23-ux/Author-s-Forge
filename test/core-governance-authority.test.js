const test = require("node:test");
const assert = require("node:assert/strict");
const { CoreGovernanceAuthority } = require("../.forge-build/application/core-governance-authority.js");
const { createForgeStudioRuntime } = require("../.forge-build/infrastructure/forge-studio-runtime.js");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

test("AI may propose but cannot silently apply author-owned creative state", () => {
  const authority = new CoreGovernanceAuthority();
  assert.deepEqual(authority.evaluate({ projectId: "p", targetId: "chapter-1", actor: "ai", mutationClass: "manuscript", intent: "propose" }), {
    allowed: true,
    requiresAuthorApproval: false,
    reason: "AI proposal does not mutate authoritative author state.",
  });
  assert.throws(() => authority.assertAllowed({ projectId: "p", targetId: "chapter-1", actor: "ai", mutationClass: "manuscript", intent: "apply" }), /explicit author approval/);
  assert.equal(authority.evaluate({ projectId: "p", targetId: "chapter-1", actor: "ai", mutationClass: "manuscript", intent: "apply", authorApproved: true }).allowed, true);
});

test("system actors are restricted to operational mutations", () => {
  const authority = new CoreGovernanceAuthority();
  assert.equal(authority.evaluate({ projectId: "p", targetId: "job-1", actor: "system", mutationClass: "operational", intent: "apply" }).allowed, true);
  assert.throws(() => authority.assertAllowed({ projectId: "p", targetId: "canon-1", actor: "system", mutationClass: "canon", intent: "apply" }), /cannot mutate author-owned creative state/);
});

test("author-directed lock and override actions remain authoritative", () => {
  const authority = new CoreGovernanceAuthority();
  assert.equal(authority.evaluate({ projectId: "p", targetId: "canon-1", actor: "author", mutationClass: "canon", intent: "lock" }).allowed, true);
  assert.equal(authority.evaluate({ projectId: "p", targetId: "voice-1", actor: "author", mutationClass: "voice", intent: "override" }).allowed, true);
});

test("ForgeStudioRuntime exposes the same shared governance boundary to downstream offices", async () => {
  const root = await mkdtemp(join(tmpdir(), "forge-governance-"));
  try {
    const runtime = createForgeStudioRuntime(root, {});
    assert.ok(runtime.governance instanceof CoreGovernanceAuthority);
    assert.throws(() => runtime.governance.assertAllowed({ projectId: "p", targetId: "character-1", actor: "ai", mutationClass: "character", intent: "apply" }), /explicit author approval/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
