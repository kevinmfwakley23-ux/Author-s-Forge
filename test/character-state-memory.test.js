import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../dist/domain/character-bible.js";
import { captureCharacterSceneState, createCharacterStateMemory, rankCharacterStateSnapshots, resolveCharacterSceneState, validateCharacterStateMemory } from "../dist/domain/character-state-memory.js";

const profile = {
  name: "Mara", age: 31, birthDate: "1995-04-02", physicalAppearance: "Tall", height: "5'10", build: "Lean", hair: "Black", eyes: "Gray", skin: "Olive", clothing: "Coat", voice: "Low and clipped", speechPatterns: ["short sentences"], personality: "Guarded", values: ["truth"], fears: ["betrayal"], secrets: ["the letter"], goals: ["find the truth"], motivations: ["protect her brother"], relationships: [{ characterId: "brother", relationship: "sibling", status: "strained", notes: "trust is damaged" }], history: "Former detective", knowledge: ["the case file"], skills: ["investigation"], weaknesses: ["isolation"], characterArc: "opens up", importantObjects: ["old key"], currentEmotionalState: "controlled", currentLocation: "Ogden", currentInjuries: [],
};

const character = createCharacter({ id: "mara", projectId: "p1", profile, now: "2026-01-01T00:00:00.000Z" });

test("character state memory captures versioned scene snapshots and resolves them", () => {
  let memory = createCharacterStateMemory(character);
  memory = captureCharacterSceneState(memory, character, { sceneId: "scene-1", capturedAt: "2026-01-02T00:00:00.000Z", changedFields: ["currentEmotionalState"] });
  memory = captureCharacterSceneState(memory, character, { sceneId: "scene-2", capturedAt: "2026-01-03T00:00:00.000Z", source: "approved-system", changedFields: ["knowledge"] });
  assert.equal(memory.snapshots.length, 2);
  assert.equal(resolveCharacterSceneState(memory, { sceneId: "scene-1" })?.sceneId, "scene-1");
  assert.equal(resolveCharacterSceneState(memory, { asOf: "2026-01-02T12:00:00.000Z" })?.sceneId, "scene-1");
  assert.equal(validateCharacterStateMemory(memory).snapshots.length, 2);
});

test("character state retrieval ranks relevant snapshots deterministically", () => {
  let memory = createCharacterStateMemory(character);
  memory = captureCharacterSceneState(memory, character, { sceneId: "quiet", changedFields: ["currentEmotionalState"] });
  memory = captureCharacterSceneState(memory, character, { sceneId: "investigation", changedFields: ["knowledge", "goals"] });
  const result = rankCharacterStateSnapshots(memory, { text: "investigation knowledge", limit: 1 });
  assert.equal(result[0]?.sceneId, "investigation");
});

test("character state memory rejects cross-character snapshots", () => {
  const memory = createCharacterStateMemory(character);
  const other = createCharacter({ ...character, id: "other" });
  assert.throws(() => captureCharacterSceneState(memory, other, { sceneId: "scene-1" }), /does not belong/);
});
