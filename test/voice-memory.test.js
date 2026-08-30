import test from "node:test";
import assert from "node:assert/strict";
import { buildVoiceMemoryProfile, mergeVoiceMemory, voiceMemoryToPromptContext } from "../dist/domain/voice-memory.js";

const sampleA = `I walked into the room and stopped. The old clock clicked above me, steady and patient, while rain worried the window. I wanted to speak, but the words would not come. So I waited, listening to the house breathe around me.`;
const sampleB = `She opened the letter slowly. Every line brought back something she had tried to forget. Outside, the street was quiet, and for one strange second she could almost believe the past had finally learned to leave her alone.`;

test("voice memory aggregates only approved samples", () => {
  const memory = buildVoiceMemoryProfile([{ id: "a", text: sampleA, approved: true, weight: 2, source: "author-approved" }, { id: "b", text: sampleB, approved: false, source: "sample" }]);
  assert.deepEqual(memory.approvedSampleIds, ["a"]);
  assert.equal(memory.sampleIds.length, 2);
  assert.ok(memory.totalSampleWords > 20);
  assert.match(voiceMemoryToPromptContext(memory), /AUTHOR VOICE MEMORY/);
});

test("voice memory merge preserves durable sample identity", () => {
  const a = buildVoiceMemoryProfile([{ id: "a", text: sampleA, approved: true }]);
  const b = buildVoiceMemoryProfile([{ id: "b", text: sampleB, approved: true }]);
  const merged = mergeVoiceMemory(a, b);
  assert.deepEqual(merged.sampleIds, ["a", "b"]);
  assert.deepEqual(merged.approvedSampleIds, ["a", "b"]);
  assert.equal(merged.totalSampleWords, a.totalSampleWords + b.totalSampleWords);
});
