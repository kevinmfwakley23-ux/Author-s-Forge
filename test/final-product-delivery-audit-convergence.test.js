const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FinalProductAuditService,
} = require("../.forge-build/application/final-product-systems.js");
const {
  DELIVERY_AUDIT_CATEGORIES: FINAL_CATEGORIES,
} = require("../.forge-build/domain/final-product-systems.js");
const { createProject } = require("../.forge-build/domain/project.js");

function allChecks(overrides = {}) {
  return FINAL_CATEGORIES.map((category) => ({
    category,
    passed: true,
    message: `${category} verified.`,
    blocking: false,
    ...overrides[category],
  }));
}

test("final product audit can be recorded into canonical durable Delivery Audit history", () => {
  const service = new FinalProductAuditService();
  const project = createProject({ id: "project-1", title: "Book", now: "2026-09-01T10:00:00.000Z" });

  const result = service.runAndRecord(project, {
    id: "final-1",
    projectId: "project-1",
    checks: allChecks(),
    generatedAt: "2026-09-01T11:00:00.000Z",
  }, "2026-09-01T11:00:01.000Z");

  assert.equal(project.deliveryAudits, undefined);
  assert.equal(result.finalAudit.status, "ready-for-author-approval");
  assert.equal(result.deliveryAudit.status, "ready-for-author-approval");
  assert.equal(result.project.deliveryAudits.length, 1);
  assert.deepEqual(result.project.deliveryAudits[0], result.deliveryAudit);
  assert.equal(result.project.metadata.updatedAt, "2026-09-01T11:00:01.000Z");
});

test("legacy characters category maps deterministically to canonical character category", () => {
  const service = new FinalProductAuditService();
  const project = createProject({ id: "project-1", title: "Book", now: "2026-09-01T10:00:00.000Z" });

  const result = service.runAndRecord(project, {
    id: "final-characters",
    projectId: "project-1",
    checks: allChecks(),
    generatedAt: "2026-09-01T11:00:00.000Z",
  });

  const character = result.deliveryAudit.checks.find((check) => check.category === "character");
  assert.ok(character);
  assert.equal(character.id, "final-product:final-characters:characters");
  assert.equal(result.deliveryAudit.checks.some((check) => check.category === "characters"), false);
});

test("blocking final-product failures remain blocking after canonical convergence", () => {
  const service = new FinalProductAuditService();
  const project = createProject({ id: "project-1", title: "Book", now: "2026-09-01T10:00:00.000Z" });

  const result = service.runAndRecord(project, {
    id: "final-blocked",
    projectId: "project-1",
    checks: allChecks({
      publishing: { passed: false, blocking: true, message: "Publishing evidence is stale." },
    }),
    generatedAt: "2026-09-01T11:00:00.000Z",
  });

  assert.equal(result.finalAudit.status, "blocked");
  assert.equal(result.deliveryAudit.status, "blocked");
  const publishing = result.deliveryAudit.checks.find((check) => check.category === "publishing");
  assert.equal(publishing.passed, false);
  assert.equal(publishing.severity, "critical");
});

test("non-blocking final-product failures remain attention after canonical convergence", () => {
  const service = new FinalProductAuditService();
  const project = createProject({ id: "project-1", title: "Book", now: "2026-09-01T10:00:00.000Z" });

  const result = service.runAndRecord(project, {
    id: "final-attention",
    projectId: "project-1",
    checks: allChecks({
      metadata: { passed: false, blocking: false, message: "Metadata needs review." },
    }),
    generatedAt: "2026-09-01T11:00:00.000Z",
  });

  assert.equal(result.finalAudit.status, "attention-required");
  assert.equal(result.deliveryAudit.status, "attention");
  const metadata = result.deliveryAudit.checks.find((check) => check.category === "metadata");
  assert.equal(metadata.passed, false);
  assert.equal(metadata.severity, "warning");
});

test("final product audit convergence rejects cross-project mutation before recording", () => {
  const service = new FinalProductAuditService();
  const project = createProject({ id: "project-1", title: "Book", now: "2026-09-01T10:00:00.000Z" });

  assert.throws(() => service.runAndRecord(project, {
    id: "foreign",
    projectId: "project-2",
    checks: allChecks(),
    generatedAt: "2026-09-01T11:00:00.000Z",
  }), /another project/i);
  assert.equal(project.deliveryAudits, undefined);
});
