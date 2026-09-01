const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const {
  createWorkbookActivity,
  generateEducationalWorkbook,
} = require("../dist/domain/educational-workbook.js");
const { FileEducationalWorkbookStore } = require("../dist/infrastructure/file-educational-workbook-store.js");
const { EducationalWorkbookOfficeService } = require("../dist/application/educational-workbook-office.js");
const { EducationalWorkbookProductionService } = require("../dist/application/educational-workbook-production.js");

const NOW = "2026-09-01T12:00:00.000Z";

function activity(id, subject, kind, prompt, answer, extra = {}) {
  return createWorkbookActivity({
    id,
    projectId: "education-project",
    subject,
    gradeBands: ["3-5"],
    kind,
    difficulty: extra.difficulty || "practice",
    prompt,
    ...(extra.choices ? { choices: extra.choices } : {}),
    ...(answer ? { answer } : {}),
    ...(extra.explanation ? { explanation: extra.explanation } : {}),
    standards: extra.standards || [],
    tags: extra.tags || [],
    points: extra.points ?? 1,
    now: NOW,
  });
}

const LIBRARY = [
  activity("math-1", "math", "math-practice", "Solve 12 × 4.", "48", { standards: ["CCSS.MATH.CONTENT.4.NBT.B.5"], tags: ["multiplication"] }),
  activity("math-2", "math", "multiple-choice", "Which fraction is equivalent to one half?", "2/4", { choices: ["1/4", "2/4", "3/4"], standards: ["CCSS.MATH.CONTENT.4.NF.A.1"], tags: ["fractions"] }),
  activity("math-3", "math", "true-false", "A square always has four equal sides.", "true", { tags: ["geometry"] }),
  activity("lit-1", "literacy", "short-answer", "What is the main idea of a paragraph?", "The central point the paragraph communicates.", { standards: ["CCSS.ELA-LITERACY.RI.4.2"], tags: ["main-idea"] }),
  activity("lit-2", "literacy", "writing-prompt", "Write three sentences describing a setting using sensory details.", undefined, { tags: ["writing"] }),
  activity("science-1", "science", "fill-in-blank", "Water freezes at ___ degrees Celsius.", "0", { tags: ["matter"] }),
];

test("Educational Workbook generator is deterministic, filtered, balanced, and answer-key aware", () => {
  const request = {
    id: "wb-1",
    projectId: "education-project",
    title: "Grade 4 Practice",
    gradeBand: "3-5",
    seed: "stable-seed",
    activityCount: 5,
    activityLibrary: LIBRARY,
    learningObjectives: ["Practice grade-appropriate literacy, math, and science skills."],
    directions: ["Show your work.", "Read every question carefully."],
    includeAnswerKey: true,
    now: NOW,
  };
  const first = generateEducationalWorkbook(request);
  const second = generateEducationalWorkbook({ ...request, id: "wb-2" });
  assert.deepEqual(first.sourceActivityIds, second.sourceActivityIds);
  assert.equal(first.activities.length, 5);
  assert.equal(new Set(first.sourceActivityIds).size, 5);
  assert.ok(Object.keys(first.subjectCounts).length >= 2);
  assert.equal(first.answerKey.length, first.activities.filter((item) => item.answer).length);
  assert.equal(first.totalPoints, first.activities.reduce((sum, item) => sum + item.points, 0));
});

test("Educational Workbook validates scored activity truth instead of accepting fake answers", () => {
  assert.throws(() => createWorkbookActivity({
    id: "bad-mc",
    projectId: "education-project",
    subject: "math",
    gradeBands: ["3-5"],
    kind: "multiple-choice",
    prompt: "Pick the answer.",
    choices: ["A", "B"],
    answer: "C",
    standards: [],
    tags: [],
    now: NOW,
  }), /answer must exactly match one choice/);
  assert.throws(() => createWorkbookActivity({
    id: "bad-tf",
    projectId: "education-project",
    subject: "science",
    gradeBands: ["3-5"],
    kind: "true-false",
    prompt: "The earth has two moons.",
    answer: "maybe",
    standards: [],
    tags: [],
    now: NOW,
  }), /answer must be true or false/);
});

test("Educational Workbook office persists library and editions across restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "forge-workbook-office-"));
  const file = join(dir, "workbooks.json");
  try {
    const office = new EducationalWorkbookOfficeService(new FileEducationalWorkbookStore(file));
    for (const item of LIBRARY) {
      await office.createActivity({
        id: item.id,
        projectId: item.projectId,
        subject: item.subject,
        gradeBands: item.gradeBands,
        kind: item.kind,
        difficulty: item.difficulty,
        prompt: item.prompt,
        choices: item.choices,
        answer: item.answer,
        explanation: item.explanation,
        standards: item.standards,
        tags: item.tags,
        points: item.points,
        now: item.createdAt,
      });
    }
    const workbook = await office.createWorkbook({
      id: "persisted-workbook",
      projectId: "education-project",
      title: "Persistent Grade 4 Workbook",
      gradeBand: "3-5",
      seed: "persisted-seed",
      activityCount: 4,
      learningObjectives: ["Review core grade 4 skills."],
      directions: ["Complete each page."],
      includeAnswerKey: true,
      now: NOW,
    });
    assert.equal(workbook.activities.length, 4);

    const restarted = new EducationalWorkbookOfficeService(new FileEducationalWorkbookStore(file));
    const activities = await restarted.listActivities("education-project");
    const editions = await restarted.listWorkbooks("education-project");
    assert.equal(activities.length, LIBRARY.length);
    assert.equal(editions.length, 1);
    assert.deepEqual(editions[0].sourceActivityIds, workbook.sourceActivityIds);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Educational Workbook production emits actual PDF bytes with optional answer key", () => {
  const workbook = generateEducationalWorkbook({
    id: "pdf-workbook",
    projectId: "education-project",
    title: "Printable Skills Workbook",
    subtitle: "Grade 4",
    gradeBand: "3-5",
    seed: "pdf-seed",
    activityCount: 4,
    activityLibrary: LIBRARY,
    learningObjectives: ["Practice core skills."],
    directions: ["Show your work."],
    includeAnswerKey: true,
    now: NOW,
  });
  const result = new EducationalWorkbookProductionService().renderPdf({
    workbook,
    bookId: "book-1",
    author: "Test Educator",
    options: { trimWidthInches: 8.5, trimHeightInches: 11, includeAnswerKey: true },
    now: NOW,
  });
  const bytes = Buffer.from(result.artifact.contentBase64, "base64");
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.equal(result.artifact.byteLength, bytes.length);
  assert.match(result.artifact.sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.layout.activityPages, 4);
  assert.ok(result.layout.answerKeyPages >= 1);
  assert.equal(result.layout.answerKeyIncluded, true);
});
