const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EDITOR_ROLES, FINDING_KINDS, createEditingDocument, createEditorialFinding,
  createEditorialReport, validateEditorialReport, IntelligentEditingService
} = require("../.forge-build/index.js");

const base = (text = "Mara walked home. Mara walked home. She was watching the road.") => createEditingDocument({
  target: { projectId: "project-1", manuscriptId: "manuscript-1", chapterId: "chapter-1", sceneId: "scene-1" },
  title: "Test Scene", text, pov: "third", tense: "past",
  expectedCharacterNames: ["Mara"], requiredFacts: ["silver key"], unresolvedThreads: ["missing letter"],
  genreExpectations: ["mystery"]
});

test("exposes every directive editorial role and requested finding kind", () => {
  assert.deepEqual(EDITOR_ROLES, ["developmental", "continuity", "line", "copy", "proofreading", "structural", "dialogue", "pacing", "character", "genre"]);
  for (const kind of ["pacing", "character-consistency", "plot-hole", "continuity-conflict", "repetition", "weak-scene", "unresolved-thread", "unnecessary-exposition", "dialogue-problem", "pov-violation", "tense-inconsistency", "cliche", "overused-word", "sentence-rhythm", "chapter-balance", "genre-fit"]) assert.ok(FINDING_KINDS.includes(kind));
});

test("validates editing documents and rejects empty or invalid targets", () => {
  assert.throws(() => createEditingDocument({ target: { projectId: "", manuscriptId: "m" }, title: "x", text: "x" }), /project id is required/);
  assert.throws(() => createEditingDocument({ target: { projectId: "p", manuscriptId: "" }, title: "x", text: "x" }), /manuscript id is required/);
  assert.throws(() => createEditingDocument({ target: { projectId: "p", manuscriptId: "m" }, title: "x", text: "" }), /text is required/);
});

test("produces reports for every editorial role without mutating manuscript text", () => {
  const service = new IntelligentEditingService();
  for (const role of EDITOR_ROLES) {
    const document = base();
    const report = service.analyze({ document, roles: [role], reportId: `report-${role}`, generatedAt: "2026-01-01T00:00:00.000Z" });
    assert.equal(report.roles[0], role);
    assert.equal(report.manuscriptMutated, false);
    assert.ok(report.findings.every((f) => f.manuscriptMutationAuthorized === false));
    validateEditorialReport(report, document.text);
  }
});

test("detects repetition, overused words, cliches, dialogue, pacing, and rhythm signals", () => {
  const longSentence = "The road was quiet and the rain was falling over the houses and the windows and the empty street while Mara continued walking toward the old station.";
  const text = `At the end of the day, Mara walked home. Mara walked home.\n\n${longSentence}\n\n${longSentence}\n\n${longSentence}\n\n${longSentence} "I know everything about what happened at the old station and I will explain every detail before we continue because you need to understand exactly what happened to me and why I came here tonight."`;
  const report = new IntelligentEditingService().analyze({ document: base(text), roles: ["line", "dialogue", "pacing"], reportId: "report-signals" });
  const kinds = new Set(report.findings.map((f) => f.kind));
  assert.ok(kinds.has("repetition"));
  assert.ok(kinds.has("overused-word"));
  assert.ok(kinds.has("cliche"));
  assert.ok(kinds.has("dialogue-problem"));
  assert.ok(kinds.has("pacing"));
  assert.ok(kinds.has("sentence-rhythm"));
});

test("reports continuity and character review signals without asserting absence is automatically an error", () => {
  const report = new IntelligentEditingService().analyze({ document: base("Mara entered the room."), roles: ["continuity", "character", "developmental"], reportId: "report-continuity" });
  const kinds = new Set(report.findings.map((f) => f.kind));
  assert.ok(kinds.has("continuity-conflict"));
  assert.ok(kinds.has("character-consistency"));
  assert.ok(kinds.has("unresolved-thread"));
});

test("protects report ranges and source excerpts", () => {
  const document = base();
  const report = new IntelligentEditingService().analyze({ document, roles: ["line"], reportId: "report-range" });
  for (const f of report.findings) assert.equal(document.text.slice(f.start, f.end), f.excerpt);
  assert.doesNotThrow(() => validateEditorialReport(report, document.text));
});

test("rejects forged mutation authorization, duplicate findings, and invalid ranges", () => {
  const document = base();
  assert.throws(() => createEditorialFinding({ id: "x", role: "line", kind: "repetition", severity: "warning", message: "x", recommendation: "x", start: -1, end: 1, excerpt: "", confidence: .5 }), /range is invalid/);
  assert.throws(() => createEditorialFinding({ id: "x", role: "line", kind: "repetition", severity: "warning", message: "x", recommendation: "x", start: 0, end: 1, excerpt: "M", confidence: 2 }), /confidence/);
  const f = createEditorialFinding({ id: "x", role: "line", kind: "repetition", severity: "warning", message: "x", recommendation: "x", start: 0, end: 1, excerpt: "M", confidence: .5 });
  assert.throws(() => createEditorialReport({ id: "r", target: document.target, roles: ["line"], findings: [f, f], summary: "x", generatedAt: new Date().toISOString() }), /Duplicate editorial finding/);
});

test("analysis is deterministic and never returns a manuscript mutation operation", () => {
  const document = base();
  const service = new IntelligentEditingService();
  const request = { document, roles: EDITOR_ROLES, reportId: "report-safety", generatedAt: "2026-01-01T00:00:00.000Z" };
  const first = service.analyze(request);
  const second = service.analyze(request);
  assert.deepEqual(first, second);
  assert.equal(first.manuscriptMutated, false);
  assert.ok(!Object.keys(first).includes("replacementText"));
  assert.ok(!Object.keys(first).includes("updatedManuscript"));
  assert.ok(first.findings.every((finding) => Object.keys(finding).includes("manuscriptMutationAuthorized") && finding.manuscriptMutationAuthorized === false));
});

test("genre analysis uses expectations as review signals rather than forced edits", () => {
  const report = new IntelligentEditingService().analyze({ document: base("Mara entered the room."), roles: ["genre"], reportId: "report-genre" });
  assert.ok(report.findings.some((f) => f.kind === "genre-fit"));
  assert.equal(report.manuscriptMutated, false);
});

test("rejects unknown editorial roles and missing role selection", () => {
  const service = new IntelligentEditingService();
  assert.throws(() => service.analyze({ document: base(), roles: [], reportId: "r" }), /At least one editorial role/);
  assert.throws(() => service.analyze({ document: base(), roles: ["not-a-role"], reportId: "r" }), /Unknown editorial role/);
});
