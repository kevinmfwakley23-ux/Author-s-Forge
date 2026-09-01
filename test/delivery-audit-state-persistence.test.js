const test = require("node:test");
const assert = require("node:assert/strict");

const { DeliveryAuditService } = require("../.forge-build/application/delivery-audit.js");
const { createDeliveryAuditReport } = require("../.forge-build/domain/delivery-audit.js");
const { createProject } = require("../.forge-build/domain/project.js");

function checks(overrides = {}) {
  return [{
    id: "publishing-ready",
    category: "publishing",
    passed: true,
    severity: "critical",
    message: "Publishing evidence is current.",
    ...overrides,
  }];
}

test("DeliveryAuditService records validated audit evidence into project state", () => {
  const service = new DeliveryAuditService();
  const project = createProject({ id: "project-1", title: "Book", now: "2026-09-01T10:00:00.000Z" });

  const recorded = service.record(
    project,
    checks(),
    "2026-09-01T11:00:00.000Z",
    "2026-09-01T11:00:01.000Z",
  );

  assert.equal(project.deliveryAudits, undefined);
  assert.equal(recorded.report.status, "ready-for-author-approval");
  assert.equal(recorded.project.deliveryAudits.length, 1);
  assert.deepEqual(recorded.project.deliveryAudits[0], recorded.report);
  assert.equal(recorded.project.metadata.updatedAt, "2026-09-01T11:00:01.000Z");
  assert.equal(Object.isFrozen(recorded), true);
});

test("DeliveryAuditService refuses tampered persisted evidence before project mutation", () => {
  const service = new DeliveryAuditService();
  const project = createProject({ id: "project-1", title: "Book", now: "2026-09-01T10:00:00.000Z" });
  const valid = createDeliveryAuditReport({
    projectId: "project-1",
    checks: checks(),
    generatedAt: "2026-09-01T11:00:00.000Z",
  });
  const tampered = { ...valid, passedCount: 0 };

  assert.throws(() => service.append(project, tampered), /summary is inconsistent/i);
  assert.equal(project.deliveryAudits, undefined);
  assert.equal(project.metadata.updatedAt, "2026-09-01T10:00:00.000Z");
});

test("DeliveryAuditService rejects cross-project audit evidence", () => {
  const service = new DeliveryAuditService();
  const project = createProject({ id: "project-1", title: "Book", now: "2026-09-01T10:00:00.000Z" });
  const foreign = createDeliveryAuditReport({
    projectId: "project-2",
    checks: checks(),
    generatedAt: "2026-09-01T11:00:00.000Z",
  });

  assert.throws(() => service.append(project, foreign), /another project/i);
  assert.equal(project.deliveryAudits, undefined);
});

test("DeliveryAuditService preserves audit history and rejects duplicate evidence timestamps", () => {
  const service = new DeliveryAuditService();
  const project = createProject({ id: "project-1", title: "Book", now: "2026-09-01T10:00:00.000Z" });
  const first = service.record(project, checks(), "2026-09-01T11:00:00.000Z").project;
  const second = service.record(
    first,
    checks({ id: "metadata-ready", category: "metadata", message: "Metadata is current." }),
    "2026-09-01T12:00:00.000Z",
  ).project;

  assert.equal(second.deliveryAudits.length, 2);
  assert.equal(second.deliveryAudits[0].generatedAt, "2026-09-01T11:00:00.000Z");
  assert.equal(second.deliveryAudits[1].generatedAt, "2026-09-01T12:00:00.000Z");
  assert.throws(
    () => service.record(second, checks({ id: "duplicate-time" }), "2026-09-01T12:00:00.000Z"),
    /duplicate delivery audit timestamp/i,
  );
});
