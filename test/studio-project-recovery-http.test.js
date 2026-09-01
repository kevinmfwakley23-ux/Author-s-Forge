const assert = require("node:assert/strict");
const test = require("node:test");
const { restoreStudioProjectFromHttp } = require("../.forge-build/application/studio-project-recovery-http.js");

function recoveryStub(result = { projectId: "p1", restored: { metadata: { id: "p1" } }, rollbackPackage: { manifest: { projectId: "p1" } } }) {
  const calls = [];
  return {
    calls,
    service: {
      async restoreExisting(projectId, pkg, rollbackExportedAt) {
        calls.push({ projectId, pkg, rollbackExportedAt });
        return result;
      },
    },
  };
}

test("recovery HTTP adapter requires explicit author approval before calling mutation service", async () => {
  const stub = recoveryStub();
  await assert.rejects(() => restoreStudioProjectFromHttp(stub.service, "p1", { package: {} }), /explicit author approval/i);
  await assert.rejects(() => restoreStudioProjectFromHttp(stub.service, "p1", { authorApproved: false, package: {} }), /explicit author approval/i);
  assert.equal(stub.calls.length, 0);
});

test("recovery HTTP adapter rejects malformed runtime request and package containers", async () => {
  const stub = recoveryStub();
  await assert.rejects(() => restoreStudioProjectFromHttp(stub.service, "p1", null), /JSON object/i);
  await assert.rejects(() => restoreStudioProjectFromHttp(stub.service, "p1", []), /JSON object/i);
  await assert.rejects(() => restoreStudioProjectFromHttp(stub.service, "p1", { authorApproved: true }), /project package is required/i);
  await assert.rejects(() => restoreStudioProjectFromHttp(stub.service, "p1", { authorApproved: true, package: [] }), /project package is required/i);
  assert.equal(stub.calls.length, 0);
});

test("recovery HTTP adapter validates optional rollback timestamp before mutation", async () => {
  const stub = recoveryStub();
  await assert.rejects(
    () => restoreStudioProjectFromHttp(stub.service, "p1", { authorApproved: true, package: {}, rollbackExportedAt: "not-a-date" }),
    /valid timestamp/i,
  );
  assert.equal(stub.calls.length, 0);
});

test("approved recovery request delegates exactly once and returns durable recovery result", async () => {
  const expected = { projectId: "p1", restored: { metadata: { id: "p1", title: "Restored" } }, rollbackPackage: { manifest: { projectId: "p1" } } };
  const stub = recoveryStub(expected);
  const pkg = { manifest: { projectId: "p1" } };
  const result = await restoreStudioProjectFromHttp(stub.service, "p1", {
    authorApproved: true,
    package: pkg,
    rollbackExportedAt: "2026-09-01T04:00:00.000Z",
  });

  assert.deepEqual(result, expected);
  assert.deepEqual(stub.calls, [{ projectId: "p1", pkg, rollbackExportedAt: "2026-09-01T04:00:00.000Z" }]);
});
