const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const {
  CHARACTER_FIELDS,
  CharacterBibleService,
  createCharacter,
  getCharacterAt,
  getCharacterChanges,
  getCharacterFieldHistory,
  createProject,
  FileProjectStore,
  withProjectCharacters
} = require("../.forge-build/index.js");

function profile(overrides = {}) {
  return {
    name: "Mara Voss",
    age: 31,
    birthDate: "1995-04-12",
    physicalAppearance: "Lean, weathered features, and a small scar beneath the left eye.",
    height: "5 ft 7 in",
    build: "Lean and athletic",
    hair: "Dark brown, shoulder length",
    eyes: "Gray-green",
    skin: "Olive",
    clothing: "Dark field jacket, worn boots, and black jeans",
    voice: "Low and controlled",
    speechPatterns: ["Short declarative sentences", "Uses silence before difficult answers"],
    personality: "Observant, guarded, and fiercely loyal",
    values: ["Loyalty", "Truth"],
    fears: ["Abandonment", "Losing control"],
    secrets: ["She withheld evidence from the first investigation"],
    goals: ["Find the missing witness"],
    motivations: ["Protect the people she failed before"],
    relationships: [{ characterId: "samuel-1", relationship: "ally", status: "strained", notes: "Trust exists but is conditional." }],
    history: "Raised in a small mountain town and trained as an investigator.",
    knowledge: ["Knows the old reservoir access roads"],
    skills: ["Investigation", "Lock bypass"],
    weaknesses: ["Distrusts authority"],
    characterArc: "Moves from controlled isolation toward honest collaboration.",
    importantObjects: ["Father's brass compass"],
    currentEmotionalState: "Watchful and exhausted",
    currentLocation: "North shoreline",
    currentInjuries: []
  , ...overrides };
}

test("Mission 010 creates every required Character Bible field and history", () => {
  const character = createCharacter({ id: "mara-1", projectId: "project-1", profile: profile(), now: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual(Object.keys(character.profile).sort(), [...CHARACTER_FIELDS].sort());
  assert.equal(CHARACTER_FIELDS.length, 27);
  for (const field of CHARACTER_FIELDS) {
    assert.equal(character.fieldHistory[field].length, 1);
    assert.equal(character.fieldHistory[field][0].field, field);
  }
});

test("character updates are immutable, auditable, and temporally reconstructable", () => {
  const initial = createCharacter({ id: "mara-1", projectId: "project-1", profile: profile(), now: "2026-01-01T00:00:00.000Z" });
  const updated = require("../.forge-build/index.js").updateCharacter(initial, {
    characterId: "mara-1",
    changes: { currentLocation: "Old watchtower", currentInjuries: ["Bruised ribs"], currentEmotionalState: "Frightened" },
    effectiveAt: "2026-01-02T00:00:00.000Z",
    reason: "Chapter 4 events",
    actor: "author"
  });

  assert.equal(initial.profile.currentLocation, "North shoreline");
  assert.equal(updated.profile.currentLocation, "Old watchtower");
  assert.deepEqual(getCharacterAt(updated, "2026-01-01T12:00:00.000Z").currentInjuries, []);
  assert.equal(getCharacterAt(updated, "2026-01-02T00:00:00.000Z").currentLocation, "Old watchtower");
  assert.equal(getCharacterFieldHistory(updated, "currentLocation").length, 2);
  assert.equal(getCharacterChanges(updated).length, 3);
});

test("service keeps characters isolated by project and supports portable restore", () => {
  const service = new CharacterBibleService();
  service.create({ id: "mara-1", projectId: "project-1", profile: profile() });
  service.create({ id: "eli-1", projectId: "project-2", profile: profile({ name: "Eli Voss", currentLocation: "Harbor" }) });
  assert.equal(service.list({ projectId: "project-1" }).length, 1);
  assert.equal(service.list({ projectId: "project-2" })[0].profile.name, "Eli Voss");

  const portable = service.toPortableState("project-1");
  const restored = new CharacterBibleService();
  restored.restoreProject("project-1", portable);
  assert.deepEqual(restored.at("mara-1", service.get("mara-1").createdAt), service.get("mara-1").profile);
  assert.throws(() => restored.restoreProject("project-2", portable), /another project/);
});

test("project persistence preserves temporal character state", async () => {
  const root = await mkdtemp(join(tmpdir(), "authors-forge-character-"));
  try {
    const store = new FileProjectStore(root);
    const project = createProject({ id: "novel-1", title: "Character Test", now: "2026-01-01T00:00:00.000Z" });
    const character = createCharacter({ id: "mara-1", projectId: "novel-1", profile: profile(), now: "2026-01-01T00:00:00.000Z" });
    const changed = require("../.forge-build/index.js").updateCharacter(character, {
      characterId: "mara-1",
      changes: { age: 32 },
      effectiveAt: "2026-02-01T00:00:00.000Z",
      reason: "Birthday",
      actor: "author"
    });
    const enriched = withProjectCharacters(project, [changed], "2026-02-01T00:00:00.000Z");
    await store.create(enriched);
    const restored = await store.load("novel-1");
    assert.deepEqual(restored, enriched);
    assert.equal(restored.characters[0].fieldHistory.age.length, 2);
    assert.equal(getCharacterAt(restored.characters[0], "2026-01-15T00:00:00.000Z").age, 31);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid character state is rejected instead of silently accepted", () => {
  assert.throws(() => createCharacter({ id: "mara-1", projectId: "project-1", profile: profile({ age: -1 }) }), /age/);
  assert.throws(() => createCharacter({ id: "mara-1", projectId: "project-1", profile: profile({ name: "" }) }), /name/);
  assert.throws(() => createCharacter({ id: "mara-1", projectId: "project-1", profile: profile({ currentInjuries: ["", "Broken wrist"] }) }), /currentInjuries/);
});
