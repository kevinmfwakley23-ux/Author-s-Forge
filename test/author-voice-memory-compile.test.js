const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthorVoiceMemory, assessVoiceDrift } = require('../dist/domain/author-voice-memory.js');
const sample = `I walked into the room and stopped. The walls were quiet, the window was dark, and the old clock kept counting. I could hear the rain outside while I looked across the shelves. Nothing moved. Nothing spoke. Still, I knew someone had been there. The feeling stayed with me as I crossed the floor and reached for the door.`;

test('author voice memory maps narrative distance to its actual fingerprint vocabulary', () => {
  const memory = createAuthorVoiceMemory({ projectId:'p', authorId:'a', samples:[{id:'s',label:'sample',text:sample}] });
  assert.equal(typeof memory.dimensions.narrativeDistance, 'number');
  assert.ok(memory.fingerprint.narrativeDistance !== 'intimate');
});

test('voice drift produces actionable dimensions', () => {
  const memory = createAuthorVoiceMemory({ projectId:'p', authorId:'a', samples:[{id:'s',label:'sample',text:sample}] });
  const report = assessVoiceDrift(sample, memory);
  assert.equal(report.matchedSamples[0], 's');
  assert.ok(report.dimensions.sentenceRhythm >= 0);
});
