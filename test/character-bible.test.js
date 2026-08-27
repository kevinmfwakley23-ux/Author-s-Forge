import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHARACTER_FIELDS, CharacterBibleService, FileProjectStore, createCharacter, createProject, getCharacterAt, getCharacterChanges, getCharacterFieldHistory, updateCharacter } from "../.forge-build/index.js";

function profile(overrides = {}) {
  return {
    name: "Mara Voss", age: 34, birthDate: "1991-05-14", physicalAppearance: "Weathered face", height: "5'8\"", build: "Lean", hair: "Dark brown", eyes: "Gray", skin: "Olive", clothing: "Wool coat", voice: "Low", speechPatterns: ["Short sentences"], personality: "Watchful", values: ["Truth"], fears: ["Isolation"], secrets: ["She lied about the fire"], goals: ["Find the missing journal"], motivations: ["Protect Eli"], relationships: [{ characterId: "eli-1", relationship: "Friend", status: "Strained", notes: "Old trust" }], history: "Former investigator", knowledge: ["Reservoir history"], skills: ["Investigation"], weaknesses: ["Distrust"], characterArc: "From isolation to trust", importantObjects: ["Brass key"], currentEmotionalState: "Watchful and exhausted", currentLocation: "North shoreline", currentInjuries: [], ...overrides
  };
}

test("Mission 010 creates every required Character Bible field and history", () => {
  const character = createCharacter({ id: "mara-1", projectId: "project-1", profile: profile(), now: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual(Object.keys(character.profile).sort(), [...CHARACTER_FIELDS].sort());
  assert.equal(CHARACTER_FIELDS.length, 28);
  for (const field of CHARACTER_FIELDS) {
    assert.equal(character.fieldHistory[field].length, 1);
    assert.equal(character.fieldHistory[field][0].field, field);
  }
});

test("character updates are immutable, auditable, and temporally reconstructable", () => {
  const initial = createCharacter({ id: "mara-1", projectId: "project-1", profile: profile(), now: "2026-01-01T00:00:00.000Z" });
  const updated = updateCharacter(initial, {
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
    const changed = updateCharacter(character, { characterId: "mara-1", changes: { currentLocation: "Old watchtower" }, effectiveAt: "2026-01-02T00:00:00.000Z", reason: "Chapter 4", actor: "author" });
    await store.save(withProjectCharacters(project, [changed]));
    const loaded = await store.load("novel-1");
    assert.equal(loaded.characters[0].profile.currentLocation, "Old watchtower");
    assert.equal(loaded.characters[0].fieldHistory.currentLocation.length, 2);
  } finally {
    await import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true, force: true }));
  }
});