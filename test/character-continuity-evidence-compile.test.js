import test from "node:test";
import assert from "node:assert/strict";
import * as continuity from "../dist/domain/character-continuity-evidence.js";

test("character continuity evidence module exposes the governed compile surface", () => {
  assert.equal(continuity.CHARACTER_CONTINUITY_EVIDENCE_FORMAT_VERSION, 1);
  assert.equal(typeof continuity.createCharacterContinuityEvidence, "function");
  assert.equal(typeof continuity.verifyCharacterContinuityEvidence, "function");
  assert.equal(typeof continuity.validateCharacterContinuityEvidence, "function");
});
