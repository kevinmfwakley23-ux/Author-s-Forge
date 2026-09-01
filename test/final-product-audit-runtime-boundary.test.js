const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DELIVERY_AUDIT_CATEGORIES,
  createFinalProductAudit,
} = require("../.forge-build/domain/final-product-systems.js");

function checks(overrides = {}) {
  return DELIVERY_AUDIT_CATEGORIES.map((category) => ({
    category,
    passed: true,
    message: `${category} verified.`,
    blocking: false,
    ...overrides[category],
  }));
}

function base(overrides = {}) {
  return {
    id: "audit-1",
    projectId: "project-1",
    checks: checks(),
    generatedAt: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

test("final product audit rejects malformed top-level runtime input deliberately", () => {
  assert.throws(() => createFinalProductAudit(null), /input object is required/i);
  assert.throws(() => createFinalProductAudit([]), /input object is required/i);
  assert.throws(() => createFinalProductAudit("audit"), /input object is required/i);
  assert.throws(() => createFinalProductAudit(base({ id: 17 })), /audit id is required/i);
  assert.throws(() => createFinalProductAudit(base({ projectId: {} })), /project id is required/i);
  assert.throws(() => createFinalProductAudit(base({ checks: {} })), /checks must be an array/i);
  assert.throws(() => createFinalProductAudit(base({ generatedAt: "not-a-date" })), /generatedAt must be a valid timestamp/i);
});

test("final product audit validates every nested check field", () => {
  const replace = (category, value) => checks().map((check) => check.category === category ? value : check);
  const mutate = (category, patch) => checks().map((check) => check.category === category ? { ...check, ...patch } : check);

  assert.throws(() => createFinalProductAudit(base({ checks: replace("canon", null) })), /check must be an object/i);
  assert.throws(() => createFinalProductAudit(base({ checks: mutate("canon", { category: "imaginary" }) })), /unsupported final audit category/i);
  assert.throws(() => createFinalProductAudit(base({ checks: mutate("canon", { passed: "yes" }) })), /passed must be a boolean/i);
  assert.throws(() => createFinalProductAudit(base({ checks: mutate("canon", { message: false }) })), /check message is required/i);
  assert.throws(() => createFinalProductAudit(base({ checks: mutate("canon", { blocking: "no" }) })), /blocking must be a boolean/i);
});

test("final product audit requires every canonical legacy category exactly once", () => {
  assert.throws(() => createFinalProductAudit(base({ checks: checks().slice(1) })), /requires exactly 13 audit categories/i);

  const duplicate = checks();
  duplicate[1] = { ...duplicate[1], category: duplicate[0].category };
  assert.throws(() => createFinalProductAudit(base({ checks: duplicate })), /duplicate or missing categories/i);
});

test("final product audit normalizes identity and message fields and freezes validated evidence", () => {
  const normalizedChecks = checks({
    canon: { message: " Canon verified. " },
  });
  const audit = createFinalProductAudit(base({
    id: " audit-1 ",
    projectId: " project-1 ",
    checks: normalizedChecks,
  }));

  assert.equal(audit.id, "audit-1");
  assert.equal(audit.projectId, "project-1");
  assert.equal(audit.checks[0].message, "Canon verified.");
  assert.equal(audit.passed, 13);
  assert.equal(audit.attention, 0);
  assert.equal(audit.blocking, 0);
  assert.equal(audit.status, "ready-for-author-approval");
  assert.equal(Object.isFrozen(audit), true);
  assert.equal(Object.isFrozen(audit.checks), true);
  assert.equal(Object.isFrozen(audit.checks[0]), true);
});

test("final product audit derives blocking and attention only from validated booleans", () => {
  const audit = createFinalProductAudit(base({ checks: checks({
    publishing: { passed: false, blocking: true, message: "Publishing blocker." },
    metadata: { passed: false, blocking: false, message: "Metadata warning." },
  }) }));

  assert.equal(audit.passed, 11);
  assert.equal(audit.attention, 1);
  assert.equal(audit.blocking, 1);
  assert.equal(audit.status, "blocked");
});
