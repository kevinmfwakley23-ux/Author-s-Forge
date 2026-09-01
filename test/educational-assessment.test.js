const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createEducationalRubric, scoreEducationalAssessment } = require("../.forge-build/domain/educational-assessment.js");
const { FileEducationalAssessmentStore } = require("../.forge-build/infrastructure/file-educational-assessment-store.js");
const { EducationalAssessmentService } = require("../.forge-build/application/educational-assessment.js");

const criteria = [
  {
    id: "accuracy",
    name: "Accuracy",
    description: "Uses correct mathematical reasoning and reaches a defensible conclusion.",
    weightPercent: 60,
    learningObjective: "Compare fractions accurately.",
    evidenceGuidance: "Look for correct comparison strategy and conclusion.",
  },
  {
    id: "reasoning",
    name: "Reasoning",
    description: "Explains why the comparison is valid.",
    weightPercent: 40,
    learningObjective: "Explain fraction comparison reasoning.",
    evidenceGuidance: "Look for a clear explanation, representation, or demonstration of reasoning.",
  },
];

const levels = [
  { id: "beginning", label: "Beginning", score: 0, description: "Little usable evidence yet." },
  { id: "meeting", label: "Meeting", score: 2, description: "Meets the objective." },
  { id: "exceeding", label: "Exceeding", score: 3, description: "Shows accurate transfer or depth." },
];

function rubric(id, projectId = "p1") {
  return createEducationalRubric({
    id,
    projectId,
    title: `Rubric ${id}`,
    gradeBand: "3-5",
    criteria,
    levels,
    allowedResponseModes: ["written", "oral", "diagram"],
    now: "2026-09-01T21:00:00.000Z",
  });
}

test("rubrics require complete weighting and honor multiple response modes", () => {
  assert.throws(
    () => createEducationalRubric({ id: "bad", projectId: "p", title: "Bad", gradeBand: "3-5", criteria: [{ ...criteria[0], weightPercent: 50 }], levels }),
    /weights must total 100/,
  );
  const result = createEducationalRubric({
    id: "r1",
    projectId: "p1",
    title: "Fractions Performance",
    gradeBand: "3-5",
    criteria,
    levels,
    allowedResponseModes: ["written", "oral", "diagram"],
    standards: ["CCSS.MATH.CONTENT.4.NF.A.2"],
    now: "2026-09-01T21:00:00.000Z",
  });
  assert.deepEqual(result.allowedResponseModes, ["written", "oral", "diagram"]);
  assert.equal(result.criteria.reduce((sum, criterion) => sum + criterion.weightPercent, 0), 100);
});

test("weighted scoring is deterministic and rejects missing or unauthorized evidence", () => {
  const result = createEducationalRubric({
    id: "r1",
    projectId: "p1",
    title: "Fractions",
    gradeBand: "3-5",
    criteria,
    levels,
    allowedResponseModes: ["written", "oral"],
  });
  const assessment = scoreEducationalAssessment({
    id: "a1",
    projectId: "p1",
    rubric: result,
    activityOrTaskId: "task-1",
    responseMode: "oral",
    scores: [
      { criterionId: "accuracy", levelId: "meeting", evidenceNote: "Correct comparison spoken aloud." },
      { criterionId: "reasoning", levelId: "exceeding", evidenceNote: "Explained using a common denominator." },
    ],
    feedback: "Accurate explanation.",
  });
  assert.equal(assessment.weightedPercent, 80);
  assert.equal(assessment.masteryBand, "proficient");
  assert.throws(
    () => scoreEducationalAssessment({ id: "a2", projectId: "p1", rubric: result, activityOrTaskId: "task-1", responseMode: "drawing", scores: assessment.scores }),
    /not allowed/,
  );
  assert.throws(
    () => scoreEducationalAssessment({ id: "a3", projectId: "p1", rubric: result, activityOrTaskId: "task-1", responseMode: "written", scores: [assessment.scores[0]] }),
    /exactly one score/,
  );
});

test("rubrics and assessment evidence survive restart and stored scores are revalidated", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-assessment-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "assessments.json");
  const service = new EducationalAssessmentService(new FileEducationalAssessmentStore(path));
  const created = await service.createRubric({
    id: "r1",
    projectId: "p1",
    title: "Performance Task",
    gradeBand: "3-5",
    criteria,
    allowedResponseModes: ["written", "diagram"],
    now: "2026-09-01T21:00:00.000Z",
  });
  const assessment = await service.score({
    id: "evidence-1",
    projectId: "p1",
    rubricId: created.id,
    activityOrTaskId: "task-1",
    responseMode: "diagram",
    scores: [
      { criterionId: "accuracy", levelId: "proficient", evidenceNote: "Correct model." },
      { criterionId: "reasoning", levelId: "advanced", evidenceNote: "Transferred strategy to new values." },
    ],
    feedback: "Strong visual reasoning.",
    now: "2026-09-01T21:05:00.000Z",
  });
  assert.equal(assessment.weightedPercent, 80);
  const restarted = new EducationalAssessmentService(new FileEducationalAssessmentStore(path));
  assert.equal((await restarted.listRubrics("p1")).length, 1);
  const records = await restarted.listAssessments("p1", "r1");
  assert.equal(records.length, 1);
  assert.equal(records[0].responseMode, "diagram");
});

test("failed persistence does not publish an unsaved rubric into running memory", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-assessment-atomic-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const parent = join(root, "state");
  const path = join(parent, "assessments.json");
  await mkdir(parent);
  const store = new FileEducationalAssessmentStore(path);
  assert.deepEqual(await store.listRubrics("p1"), []);
  await rm(parent, { recursive: true, force: true });
  await writeFile(parent, "blocks-directory-recreation", "utf8");
  await assert.rejects(store.saveRubric(rubric("r-failed")));
  assert.deepEqual(await store.listRubrics("p1"), []);
});

test("concurrent rubric writes are serialized without losing durable records", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-assessment-concurrent-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "assessments.json");
  const store = new FileEducationalAssessmentStore(path);
  await Promise.all([store.saveRubric(rubric("r1")), store.saveRubric(rubric("r2"))]);
  assert.equal((await store.listRubrics("p1")).length, 2);
  const restarted = new FileEducationalAssessmentStore(path);
  assert.deepEqual((await restarted.listRubrics("p1")).map((item) => item.id).sort(), ["r1", "r2"]);
});
