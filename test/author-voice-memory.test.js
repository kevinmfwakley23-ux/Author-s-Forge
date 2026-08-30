import test from "node:test";
import assert from "node:assert/strict";
import { buildAuthorVoiceContext, createAuthorVoiceMemory, assessVoiceDrift, updateAuthorVoiceMemory } from "../dist/index.js";

const SAMPLE_A = `I walked into the room and stopped. The window was open, although I could not remember opening it. Outside, rain moved across the glass in thin silver lines. "You came," she said. I nodded because there was nothing useful to say. The house had always been quiet, but that night it felt as if it were listening.`;
const SAMPLE_B = `By morning I had decided the noise was nothing. That was the sensible answer. Sensible answers were easier than the truth. I made coffee, watched the steam disappear, and told myself I would leave before noon. I did not leave.`;

 test("author voice memory aggregates approved corpus and preserves canonical samples", () => {
  const memory = createAuthorVoiceMemory({ projectId: "p1", authorId: "a1", samples: [
    { id: "s1", label: "chapter sample", text: SAMPLE_A, weight: 2 },
    { id: "s2", label: "memoir sample", text: SAMPLE_B, weight: 1 },
  ] });
  assert.equal(memory.formatVersion, 1);
  assert.deepEqual(memory.canonicalSampleIds, ["s1", "s2"]);
  assert.equal(memory.samples.length, 2);
  assert.ok(memory.fingerprint.sampleWordCount > 20);
  assert.match(buildAuthorVoiceContext(memory), /AUTHOR VOICE MEMORY/);
});

test("author voice memory supports corpus updates without losing provenance", () => {
  const memory = createAuthorVoiceMemory({ projectId: "p1", authorId: "a1", samples: [{ id: "s1", label: "one", text: SAMPLE_A }] });
  const updated = updateAuthorVoiceMemory(memory, { addSamples: [{ id: "s2", label: "two", text: SAMPLE_B, weight: 2 }], canonicalSampleIds: ["s2"] });
  assert.equal(updated.samples.length, 2);
  assert.deepEqual(updated.canonicalSampleIds, ["s2"]);
  assert.notEqual(updated.updatedAt, memory.updatedAt);
});

test("voice drift assessment returns actionable warnings for materially different prose", () => {
  const memory = createAuthorVoiceMemory({ projectId: "p1", authorId: "a1", samples: [{ id: "s1", label: "one", text: SAMPLE_A }] });
  const draft = `YOU SHOULD ALWAYS WRITE LIKE THIS. THIS TEXT IS EXTREMELY DIFFERENT AND USES SHORT WORDS. LOUD. FAST. LOUD. FAST. LOUD.`;
  const report = assessVoiceDrift(draft, memory);
  assert.ok(report.distance >= 0);
  assert.equal(report.matchedSamples.length, 1);
  assert.ok(report.warnings.length > 0);
});
