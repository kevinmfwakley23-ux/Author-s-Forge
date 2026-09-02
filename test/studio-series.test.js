const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { FileProjectStore } = require("../.forge-build/infrastructure/file-project-store.js");
const { StudioSeriesService } = require("../.forge-build/application/studio-series.js");
const { createProject, withProjectStudioWorkspace } = require("../.forge-build/domain/project.js");
const { createStudioWorkspace, createWorkspaceBook, addWorkspaceBook } = require("../.forge-build/domain/studio-workspace.js");
const { createSeries, validateSeriesState, reorderSeriesBooks } = require("../.forge-build/domain/series.js");

function workspace() {
  let state = createStudioWorkspace();
  state = addWorkspaceBook(state, createWorkspaceBook({ id: "book-1", title: "Winter Gate", kind: "novel", now: "2026-09-02T12:00:00Z" }));
  state = addWorkspaceBook(state, createWorkspaceBook({ id: "book-2", title: "Ashes Beyond", kind: "novel", now: "2026-09-02T12:01:00Z" }));
  return state;
}

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "forge-series-"));
  const store = new FileProjectStore(root);
  const project = withProjectStudioWorkspace(
    createProject({ id: "series-project", title: "Series Project", now: "2026-09-02T12:00:00Z" }),
    workspace(),
    "2026-09-02T12:01:00Z",
  );
  await store.create(project);
  try { await run({ root, store, service: new StudioSeriesService(store) }); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test("Series workflow persists shared canon fields, book order, unresolved threads, and timeline in project.json", async () => {
  await fixture(async ({ root, service }) => {
    let snapshot = await service.create("series-project", {
      id: "heartwood",
      name: "Heartwood Jungle",
      bookIds: ["book-1"],
      worldRules: ["The Heartwood Tree remains the geographic center."],
      locations: ["Heartwood Jungle"],
      terminology: ["Heartwood Tree"],
      history: ["The old trails predate every current character."],
      unresolvedThreads: ["Who first marked the heart-knot?"],
      now: "2026-09-02T12:02:00Z",
    });
    assert.equal(snapshot.series[0].name, "Heartwood Jungle");
    assert.deepEqual(snapshot.series[0].bookIds, ["book-1"]);

    snapshot = await service.addBook("series-project", "heartwood", "book-2", "2026-09-02T12:03:00Z");
    snapshot = await service.addTimelineEvent("series-project", "heartwood", {
      id: "gate-opens", date: "Book 2 / winter", bookId: "book-2", description: "The northern gate opens.",
    }, "2026-09-02T12:04:00Z");
    snapshot = await service.reorderBooks("series-project", "heartwood", ["book-2", "book-1"], "2026-09-02T12:05:00Z");
    assert.deepEqual(snapshot.series[0].bookIds, ["book-2", "book-1"]);
    assert.equal(snapshot.series[0].timeline[0].bookId, "book-2");

    const restarted = new StudioSeriesService(new FileProjectStore(root));
    const restored = await restarted.snapshot("series-project");
    assert.deepEqual(restored.series[0].bookIds, ["book-2", "book-1"]);
    assert.deepEqual(restored.series[0].unresolvedThreads, ["Who first marked the heart-knot?"]);
    assert.equal(restored.series[0].timeline[0].description, "The northern gate opens.");
  });
});

test("Series update is explicit and rejects references outside the durable project", async () => {
  await fixture(async ({ service }) => {
    await service.create("series-project", { id: "s", name: "Series", bookIds: ["book-1"] });
    let snapshot = await service.update("series-project", "s", {
      name: "Series Revised",
      worldRules: ["Rule one"],
      terminology: ["The Veil"],
      locations: ["Old City"],
      history: ["Founding war"],
      unresolvedThreads: ["Who opened the gate?"],
    });
    assert.equal(snapshot.series[0].name, "Series Revised");
    assert.deepEqual(snapshot.series[0].worldRules, ["Rule one"]);
    await assert.rejects(() => service.addBook("series-project", "s", "missing-book"), /Book "missing-book" not found/);
    await assert.rejects(() => service.update("series-project", "s", { sharedCharacters: ["missing-character"] }), /Series character "missing-character" not found/);
    snapshot = await service.snapshot("series-project");
    assert.deepEqual(snapshot.series[0].bookIds, ["book-1"]);
    assert.deepEqual(snapshot.series[0].sharedCharacters, []);
  });
});

test("Series refuses destructive book removal while timeline evidence still depends on that book", async () => {
  await fixture(async ({ service }) => {
    await service.create("series-project", { id: "s", name: "Series", bookIds: ["book-1", "book-2"] });
    await service.addTimelineEvent("series-project", "s", { id: "e1", date: "Year 2", bookId: "book-2", description: "A consequence crosses books." });
    await assert.rejects(() => service.removeBook("series-project", "s", "book-2"), /still has series timeline events/);
    await service.removeTimelineEvent("series-project", "s", "e1");
    const snapshot = await service.removeBook("series-project", "s", "book-2");
    assert.deepEqual(snapshot.series[0].bookIds, ["book-1"]);
  });
});

test("Series validation rejects duplicate timeline ids and timeline references outside series membership", () => {
  const base = createSeries({ id: "s", projectId: "p", name: "Series", bookIds: ["b1"] });
  assert.throws(() => validateSeriesState({
    ...base,
    timeline: [
      { id: "same", date: "one", bookId: "b1", description: "first" },
      { id: "same", date: "two", bookId: "b1", description: "second" },
    ],
  }), /Duplicate timeline event id/);
  assert.throws(() => validateSeriesState({
    ...base,
    timeline: [{ id: "outside", date: "one", bookId: "b2", description: "invalid" }],
  }), /outside the series/);
  assert.throws(() => reorderSeriesBooks(base, ["b1", "b2"]), /every current series book exactly once/);
});

test("Deleting a series is explicit and does not delete manuscript books", async () => {
  await fixture(async ({ store, service }) => {
    await service.create("series-project", { id: "s", name: "Series", bookIds: ["book-1", "book-2"] });
    const snapshot = await service.remove("series-project", "s");
    assert.deepEqual(snapshot.series, []);
    const project = await store.load("series-project");
    assert.deepEqual(project.studioWorkspace.books.map((book) => book.id), ["book-1", "book-2"]);
  });
});
