const test = require('node:test');
const assert = require('node:assert/strict');
const { AUTHOR_TRAINING_QUESTIONS } = require('../dist/application/studio-author-training-routes.js');
const { analyzeRhymeStory } = require('../dist/domain/rhyme-storytelling.js');
const { buildForgeQualityContract, evaluateForgeOutput } = require('../dist/application/forge-quality-contract.js');
const { AiModelBroker } = require('../dist/application/ai-model-broker.js');
const { AiExecutionFallback } = require('../dist/application/ai-execution-fallback.js');

test('Author Training covers thinking feeling speech storytelling values humor conflict and boundaries with unique questions', () => {
  assert.ok(AUTHOR_TRAINING_QUESTIONS.length >= 14);
  assert.equal(new Set(AUTHOR_TRAINING_QUESTIONS.map((question) => question.id)).size, AUTHOR_TRAINING_QUESTIONS.length);
  const categories = new Set(AUTHOR_TRAINING_QUESTIONS.map((question) => question.category));
  for (const category of ['thinking','emotion','speech','storytelling','values','humor','conflict','boundaries']) assert.ok(categories.has(category), `missing ${category}`);
});

test('rhyme craft analyzes cadence and rhyme without rewriting the author text', () => {
  const source = [
    'A tiger padded through the night,',
    'Beneath the moon so warm and bright,',
    'He heard a friend beside the tree,',
    'Who laughed and shared a cup of tea.',
  ].join('\n');
  const report = analyzeRhymeStory(source, 'gentle-musical');
  assert.equal(report.nonBlankLineCount, 4);
  assert.equal(report.lines.map((line) => line.text).join('\n'), source);
  assert.ok(report.cadenceConsistency >= 0 && report.cadenceConsistency <= 1);
  assert.ok(report.endRhymeCoverage >= 0 && report.endRhymeCoverage <= 1);
  assert.ok(report.recommendations.some((item) => /meaning|character voice|emotional truth/i.test(item)));
});

test('model-independent quality contract rejects fake and unfinished output but accepts substantive work', () => {
  const contract = buildForgeQualityContract('writing');
  assert.match(contract, /author remains the decision-maker/i);
  assert.match(contract, /never fabricate research/i);
  const bad = evaluateForgeOutput({ text: 'TODO: insert content here', task: 'writing', userPrompt: 'Write a scene.' });
  assert.equal(bad.accepted, false);
  const good = evaluateForgeOutput({ text: 'Mara crossed the empty room and stopped beside the rain-streaked window. She kept her hand on the letter, not because it comforted her, but because she still had not decided whether she was ready to read the final line again.', task: 'writing', userPrompt: 'Write a scene.' });
  assert.equal(good.accepted, true);
});

test('quality-gate rejection retries another eligible model instead of presenting degraded work', async () => {
  const broker = new AiModelBroker();
  broker.setResources([
    { provider:'first', model:'weak', configured:true, capabilities:{ creativeWriting:true, instructionFollowing:true } },
    { provider:'second', model:'strong', configured:true, capabilities:{ creativeWriting:true, instructionFollowing:true } },
  ]);
  const fallback = new AiExecutionFallback(broker);
  const result = await fallback.execute({ task:'writing', input:{}, maxAttempts:2, requiresCreativeWriting:true, requiresInstructionFollowing:true }, async (_input, context) => {
    if (context.resource.provider === 'first') throw new Error('Forge quality gate rejected provider output: placeholder content.');
    return 'publication-usable result';
  });
  assert.equal(result.value, 'publication-usable result');
  assert.equal(result.resource.provider, 'second');
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].error, /quality gate/i);
});
