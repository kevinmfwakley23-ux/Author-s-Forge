const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DELIVERY_AUDIT_FORMAT_VERSION,
  createDeliveryAuditReport,
  validateDeliveryAuditReport,
} = require("../.forge-build/domain/delivery-audit.js");

function check(overrides = {}) {
  return {
    id: "canon-current",
    category: "canon",
    passed: true,
    severity: "critical",
    message: "Current canon has no blocking conflict.",
    ...overrides,
  };
}

function report(overrides = {}) {
  return {
    formatVersion: DELIVERY_AUDIT_FORMAT_VERSION,
    projectId: "project-1",
    generatedAt: "2026-09-01T12:00:00.000Z",
    checks: [check()],
    passedCount: 1,
    attentionCount: 0,
    status: "ready-for-author-approval",
    ...overrides,
  };
}

test("delivery audit creation rejects malformed runtime input deliberately", () => {
  assert.throws(() => createDeliveryAuditReport(null), /input object is required/i);
  assert.throws(() => createDeliveryAuditReport([]), /input object is required/i);
  assert.throws(() => createDeliveryAuditReport("audit"), /input object is required/i);
  assert.throws(() => createDeliveryAuditReport({ projectId: 17, checks: [] }), /project id is required/i);
  assert.throws(() => createDeliveryAuditReport({ projectId: "project-1", checks: {} }), /checks must be an array/i);
  assert.throws(
    () => createDeliveryAuditReport({ projectId: "project-1", checks: [], generatedAt: "not-a-date" }),
    /generatedAt must be a valid timestamp/i,
  );
});

test("delivery audit validates every check field at the runtime boundary", () => {
  const input = (value) => ({ projectId: "project-1", checks: [value], generatedAt: "2026-09-01T12:00:00.000Z" });

  assert.throws(() => createDeliveryAuditReport(input(null)), /check must be an object/i);
  assert.throws(() => createDeliveryAuditReport(input(check({ id: "   " }))), /check id is required/i);
  assert.throws(() => createDeliveryAuditReport(input(check({ category: "imaginary" }))), /unsupported audit category/i);
  assert.throws(() => createDeliveryAuditReport(input(check({ passed: "yes" }))), /passed must be a boolean/i);
  assert.throws(() => createDeliveryAuditReport(input(check({ severity: "urgent" }))), /unsupported audit severity/i);
  assert.throws(() => createDeliveryAuditReport(input(check({ message: false }))), /check message is required/i);
  assert.throws(() => createDeliveryAuditReport(input(check({ remediation: 42 }))), /remediation must be a string/i);
});

test("delivery audit normalizes identifiers and derives release status from validated checks", () => {
  const created = createDeliveryAuditReport({
    projectId: " project-1 ",
    generatedAt: "2026-09-01T12:00:00.000Z",
    checks: [
      check({ id: " canon-current ", message: " Canon is current. " }),
      check({ id: "metadata-warning", category: "metadata", severity: "warning", passed: false, message: " Metadata needs attention. ", remediation: " Add the missing field. " }),
    ],
  });

  assert.equal(created.projectId, "project-1");
  assert.equal(created.checks[0].id, "canon-current");
  assert.equal(created.checks[0].message, "Canon is current.");
  assert.equal(created.checks[1].remediation, "Add the missing field.");
  assert.equal(created.passedCount, 1);
  assert.equal(created.attentionCount, 1);
  assert.equal(created.status, "attention");
  assert.equal(Object.isFrozen(created), true);
  assert.equal(Object.isFrozen(created.checks), true);
  assert.equal(Object.isFrozen(created.checks[0]), true);
});

test("delivery audit duplicate ids are rejected after normalization", () => {
  assert.throws(
    () => createDeliveryAuditReport({
      projectId: "project-1",
      checks: [check({ id: "canon-current" }), check({ id: " canon-current ", category: "continuity" })],
    }),
    /duplicate audit check id/i,
  );
});

test("delivery audit report validation rejects tampered persisted summaries and unsupported formats", () => {
  assert.throws(() => validateDeliveryAuditReport(null), /report is required/i);
  assert.throws(() => validateDeliveryAuditReport(report({ formatVersion: 999 })), /unsupported delivery audit format version/i);
  assert.throws(() => validateDeliveryAuditReport(report({ passedCount: 0 })), /summary is inconsistent/i);
  assert.throws(() => validateDeliveryAuditReport(report({ attentionCount: 9 })), /summary is inconsistent/i);
  assert.throws(() => validateDeliveryAuditReport(report({ status: "blocked" })), /summary is inconsistent/i);
  assert.throws(() => validateDeliveryAuditReport(report({ generatedAt: "yesterday" })), /generatedAt must be a valid timestamp/i);
});

test("failed critical delivery checks deterministically block author approval", () => {
  const created = createDeliveryAuditReport({
    projectId: "project-1",
    checks: [check({ passed: false, severity: "critical", message: "Canon conflict remains." })],
    generatedAt: "2026-09-01T12:00:00.000Z",
  });

  assert.equal(created.status, "blocked");
  assert.equal(created.passedCount, 0);
  assert.equal(created.attentionCount, 1);
  assert.deepEqual(validateDeliveryAuditReport(created), created);
});
