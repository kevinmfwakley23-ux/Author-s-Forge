const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createWorkbookActivity } = require("../.forge-build/domain/educational-workbook.js");
const { FileEducationalWorkbookStore } = require("../.forge-build/infrastructure/file-educational-workbook-store.js");
const { FileEducationalWorkbookDifferentiationStore } = require("../.forge-build/infrastructure/file-educational-workbook-differentiation-store.js");
const { EducationalWorkbookOfficeService } = require("../.forge-build/application/educational-workbook-office.js");
const { EducationalWorkbookDifferentiationService } = require("../.forge-build/application/educational-workbook-differentiation.js");
const { EducationalWorkbookDifferentiationProductionService } = require("../.forge-build/application/educational-workbook-differentiation-production.js");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "forge-workbook-diff-"));
  const workbookStore = new FileEducationalWorkbookStore(join(root, "workbooks.json"));
  const office = new EducationalWorkbookOfficeService(workbookStore);
  const diffStore = new FileEducationalWorkbookDifferentiationStore(join(root, "differentiation.json"));
  const service = new EducationalWorkbookDifferentiationService(office, diffStore);
  return { root, office, service, workbookStore, diffStore };
}

function activity(id, difficulty, index) {
  return createWorkbookActivity({
    id,
    projectId: "project-1",
    subject: "math",
    gradeBands: ["3-5"],
    kind: "math-practice",
    difficulty,
    prompt: `Solve fraction practice ${index}.`,
    answer: String(index),
    explanation: `Expected answer ${index}.`,
    standards: ["CCSS.MATH.CONTENT.4.NF.A.2"],
    tags: ["fractions", "unit-2"],
    points: 1,
    now: `2026-09-01T20:${String(index).padStart(2, "0")}:00.000Z`,
  });
}

async function seed(office, counts = { intro: 3, practice: 3, challenge: 3 }) {
  let index = 1;
  for (const difficulty of ["intro", "practice", "challenge"]) {
    for (let i = 0; i < counts[difficulty]; i += 1) {
      await office.createActivity(activity(`${difficulty}-${i + 1}`, difficulty, index++));
    }
  }
}

test("readiness reports exact source counts and refuses incomplete differentiation truth", async (t) => {
  const { root, office, service } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await seed(office, { intro: 2, practice: 3, challenge: 1 });
  const readiness = await service.readiness({ projectId: "project-1", gradeBand: "3-5", activityCountPerVariant: 2, subjects: ["math"], standards: ["CCSS.MATH.CONTENT.4.NF.A.2"], tags: ["fractions"] });
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.tiers.map((tier) => [tier.tier, tier.eligibleActivityCount, tier.ready]), [["support", 2, true], ["core", 3, true], ["extension", 1, false]]);
  await assert.rejects(() => service.createPack({ id: "pack-1", projectId: "project-1", title: "Fractions", gradeBand: "3-5", seed: "seed-1", activityCountPerVariant: 2, learningObjectives: ["Compare fractions"], subjects: ["math"], standards: ["CCSS.MATH.CONTENT.4.NF.A.2"], tags: ["fractions"] }), /not ready.*extension\/challenge: 1\/2/i);
  assert.equal((await office.listWorkbooks("project-1")).length, 0, "failed readiness must not create partial editions");
});

test("creates three durable tier-specific workbook editions and preserves the pack across restart", async (t) => {
  const { root, office, service } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await seed(office);
  const pack = await service.createPack({ id: "fractions-pack", projectId: "project-1", title: "Fractions Unit", gradeBand: "3-5", seed: "fractions-seed", activityCountPerVariant: 2, learningObjectives: ["Compare fractions", "Explain reasoning"], directions: ["Show your work"], subjects: ["math"], standards: ["CCSS.MATH.CONTENT.4.NF.A.2"], tags: ["fractions"], includeAnswerKey: true, now: "2026-09-01T21:00:00.000Z" });
  assert.deepEqual(pack.variants.map((variant) => [variant.tier, variant.difficulty, variant.workbookId]), [["support", "intro", "fractions-pack-support"], ["core", "practice", "fractions-pack-core"], ["extension", "challenge", "fractions-pack-extension"]]);
  const editions = await office.listWorkbooks("project-1");
  assert.equal(editions.length, 3);
  for (const variant of pack.variants) {
    const edition = editions.find((item) => item.id === variant.workbookId);
    assert.ok(edition);
    assert.equal(edition.activities.length, 2);
    assert.ok(edition.activities.every((item) => item.difficulty === variant.difficulty));
    assert.ok(edition.directions.length >= 2);
  }
  const restartedOffice = new EducationalWorkbookOfficeService(new FileEducationalWorkbookStore(join(root, "workbooks.json")));
  const restarted = new EducationalWorkbookDifferentiationService(restartedOffice, new FileEducationalWorkbookDifferentiationStore(join(root, "differentiation.json")));
  const history = await restarted.list("project-1");
  assert.equal(history.length, 1);
  assert.equal(history[0].id, "fractions-pack");
  assert.equal((await restartedOffice.listWorkbooks("project-1")).length, 3);
});

test("teacher guide production emits a validated real PDF with all three tiers", async (t) => {
  const { root, office, service } = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await seed(office);
  const pack = await service.createPack({ id: "guide-pack", projectId: "project-1", title: "Teacher Guide Pack", gradeBand: "3-5", seed: "guide-seed", activityCountPerVariant: 1, learningObjectives: ["Compare fractions"], subjects: ["math"], tags: ["fractions"], now: "2026-09-01T22:00:00.000Z" });
  const result = new EducationalWorkbookDifferentiationProductionService().renderTeacherGuide({ pack, bookId: "guide-book", author: "Test Educator", now: "2026-09-01T22:05:00.000Z" });
  const bytes = Buffer.from(result.artifact.contentBase64, "base64");
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.equal(result.totalPages, 4);
  assert.equal(result.artifact.mimeType, "application/pdf");
  assert.equal(result.artifact.byteLength, bytes.length);
  assert.match(result.artifact.sha256, /^[a-f0-9]{64}$/);
  assert.match(bytes.toString("latin1"), /Supported Practice/);
  assert.match(bytes.toString("latin1"), /Core Practice/);
  assert.match(bytes.toString("latin1"), /Extension Challenge/);
});
