const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createManuscriptState, createBook, createChapter, createScene, addBook, addChapter, addScene,
  createManuscriptPlanningState, createManuscriptPlan, addManuscriptPlan, replaceManuscriptPlan,
  getCurrentManuscriptPlan, validateManuscriptPlanningState, ManuscriptPlanningService
} = require("../.forge-build/index.js");

function manuscript() {
  let state = addBook(createManuscriptState(), createBook({ id: "book-1", projectId: "project-1", title: "Book" }));
  state = addChapter(state, createChapter({ id: "chapter-1", bookId: "book-1", number: 1, title: "Chapter" }));
  return addScene(state, createScene({ id: "scene-1", chapterId: "chapter-1", order: 1, title: "Scene" }));
}
function planInput(overrides = {}) {
  return { id: "plan-1", projectId: "project-1", targetType: "scene", targetId: "scene-1", purpose: "Advance the conflict", summary: "The protagonist discovers the hidden cost.", beats: ["Discovery", "Confrontation"], constraints: ["Preserve established canon"], openQuestions: ["Who knows the truth?"] , ...overrides };
}

test("creates canonical planning records with explicit structured intent", () => {
  const plan = createManuscriptPlan(planInput());
  assert.equal(plan.version, 1);
  assert.equal(plan.lifecycle, "planned");
  assert.deepEqual(plan.beats, ["Discovery", "Confrontation"]);
  assert.equal(plan.supersedesPlanId, null);
});

test("rejects invalid identifiers, versions, lifecycle values, and meaningful empty content", () => {
  assert.throws(() => createManuscriptPlan(planInput({ id: "" })), /Plan id is required/);
  assert.throws(() => createManuscriptPlan(planInput({ version: 0 })), /Plan version must be a positive integer/);
  assert.throws(() => createManuscriptPlan(planInput({ lifecycle: "invalid" })), /Invalid plan lifecycle/);
  assert.throws(() => createManuscriptPlan(planInput({ purpose: "" })), /Plan purpose is required/);
  assert.throws(() => createManuscriptPlan(planInput({ beats: [" "] })), /Plan beat is required/);
});

test("rejects unknown targets and cross-project target ownership", () => {
  const state = manuscript();
  const planning = createManuscriptPlanningState();
  assert.throws(() => addManuscriptPlan(planning, state, createManuscriptPlan(planInput({ targetId: "missing" }))), /unknown scene/);
  assert.throws(() => addManuscriptPlan(planning, state, createManuscriptPlan(planInput({ projectId: "project-2" }))), /outside project/);
});

test("rejects duplicate plan identifiers and duplicate current target plans", () => {
  const state = manuscript();
  let planning = addManuscriptPlan(createManuscriptPlanningState(), state, createManuscriptPlan(planInput()));
  assert.throws(() => addManuscriptPlan(planning, state, createManuscriptPlan(planInput({ id: "plan-2" }))), /current plan already exists/);
  assert.throws(() => addManuscriptPlan(planning, state, createManuscriptPlan(planInput())), /Duplicate manuscript plan identifier/);
});

test("replaces a plan with an explicit sequential superseding version", () => {
  const state = manuscript();
  let planning = addManuscriptPlan(createManuscriptPlanningState(), state, createManuscriptPlan(planInput()));
  const replacement = createManuscriptPlan(planInput({ id: "plan-2", version: 2, lifecycle: "working", supersedesPlanId: "plan-1", summary: "The discovery changes the immediate objective." }));
  planning = replaceManuscriptPlan(planning, state, replacement);
  assert.equal(planning.plans.find((p) => p.id === "plan-1").lifecycle, "superseded");
  assert.equal(getCurrentManuscriptPlan(planning, state, "scene", "scene-1").id, "plan-2");
  assert.equal(getCurrentManuscriptPlan(planning, state, "scene", "scene-1").version, 2);
  validateManuscriptPlanningState(planning, state);
});

test("rejects replacement that changes target identity or skips a version", () => {
  const state = manuscript();
  let planning = addManuscriptPlan(createManuscriptPlanningState(), state, createManuscriptPlan(planInput()));
  assert.throws(() => replaceManuscriptPlan(planning, state, createManuscriptPlan(planInput({ id: "plan-2", version: 3, supersedesPlanId: "plan-1" }))), /version must advance/);
  assert.throws(() => replaceManuscriptPlan(planning, state, createManuscriptPlan(planInput({ id: "plan-3", version: 2, targetId: "chapter-1", targetType: "chapter", supersedesPlanId: "plan-1" }))), /cannot change project or target identity/);
});

test("retrieves plans deterministically and preserves portable structured state", () => {
  const state = manuscript();
  let planning = addManuscriptPlan(createManuscriptPlanningState(), state, createManuscriptPlan(planInput()));
  planning = replaceManuscriptPlan(planning, state, createManuscriptPlan(planInput({ id: "plan-2", version: 2, lifecycle: "locked", supersedesPlanId: "plan-1" })));
  const current = getCurrentManuscriptPlan(planning, state, "scene", "scene-1");
  assert.equal(current.lifecycle, "locked");
  assert.deepEqual(current.beats, ["Discovery", "Confrontation"]);
  assert.equal(Object.prototype.hasOwnProperty.call(current, "filesystemPath"), false);
  validateManuscriptPlanningState(JSON.parse(JSON.stringify(planning)), state);
});

test("application service owns planning transitions without provider-specific state", () => {
  const service = new ManuscriptPlanningService(manuscript());
  service.create(planInput());
  const replacement = service.replace({ ...planInput({ id: "plan-2", version: 2 }), lifecycle: "locked" });
  assert.equal(replacement.supersedesPlanId, "plan-1");
  assert.equal(service.current("scene", "scene-1").id, "plan-2");
  assert.equal(service.snapshot().plans.length, 2);
});
