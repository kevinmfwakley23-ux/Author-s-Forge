import test from "node:test";
import assert from "node:assert/strict";
import { createAuthorVoiceMemory, updateAuthorVoiceMemory, buildAuthorVoiceContext } from "../dist/domain/author-voice-memory.js";

const sampleA = `I walked into the room and stopped. The old clock clicked above me, steady and patient, while rain worried the window. I wanted to speak, but the words would not come. So I waited, listening to the house breathe around me.`;
const sampleB = `She opened the letter slowly. Every line brought back something she had tried to forget. Outside, the street was quiet, and for one strange second she could almost believe the past had finally learned to leave her alone.`;

test("voice memory aggregates only approved weighted samples", () => {
  const memory = createAuthorVoiceMemory({
    projectId: "project-1",
    authorId: "author-1",
    samples: [
      { id: "a", label: "Approved prose", text: sampleA, approved: true, weight: 2, source: "author" },
      { id: "b", label: "Unapproved sample", text: sampleB, approved: false, source: "author" },
    ],
  });
  assert.deepEqual(memory.canonicalSampleIds, ["a"]);
  assert.equal(memory.samples.length, 2);
  assert.ok(memory.fingerprint.sampleWordCount > 20);
  assert.match(buildAuthorVoiceContext(memory), /AUTHOR VOICE MEMORY/);
});

test("voice memory update preserves durable sample identity", () => {
  const initial = createAuthorVoiceMemory({ projectId: "project-1", authorId: "author-1", samples: [{ id: "a", label: "A", text: sampleA, approved: true }] });
  const updated = updateAuthorVoiceMemory(initial, { addSamples: [{ id: "b", label: "B", text: sampleB, approved: true }], canonicalSampleIds: ["a", "b"] });
  assert.deepEqual(updated.samples.map((sample) => sample.id).sort(), ["a", "b"]);
  assert.deepEqual(updated.canonicalSampleIds, ["a", "b"]);
  assert.ok(updated.fingerprint.sampleWordCount > initial.fingerprint.sampleWordCount);
});
