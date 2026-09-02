const test = require('node:test');
const assert = require('node:assert/strict');
const { lookupWordChoice } = require('../dist/application/studio-lexical-routes.js');

test('dictionary and thesaurus lookup combines real-source response shapes into author-selectable alternatives', async () => {
  const oldFetch = global.fetch;
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes('dictionaryapi')) return new Response(JSON.stringify([{
      word:'gentle', phonetic:'/ˈdʒɛntəl/', meanings:[{ partOfSpeech:'adjective', synonyms:['mild'], definitions:[{ definition:'having a mild or kindly nature', example:'a gentle voice', synonyms:['soft'] }] }]
    }]), { status:200, headers:{'content-type':'application/json'} });
    if (value.includes('rel_syn=')) return new Response(JSON.stringify([{ word:'tender', score:900, tags:['adj','f:12.4'], defs:['adj\tshowing care'], numSyllables:2 }]), { status:200, headers:{'content-type':'application/json'} });
    if (value.includes('ml=')) return new Response(JSON.stringify([{ word:'calm', score:700, tags:['adj'], defs:['adj\tnot agitated'], numSyllables:1 }]), { status:200, headers:{'content-type':'application/json'} });
    throw new Error(`unexpected URL ${value}`);
  };
  try {
    const result = await lookupWordChoice('gentle', { sentence:'Luke gave a gentle answer.' });
    assert.equal(result.query, 'gentle');
    assert.match(result.definitions[0].definition, /mild or kindly nature/);
    assert.ok(result.candidates.some((item) => item.word === 'tender'));
    assert.ok(result.candidates.some((item) => item.word === 'soft'));
    assert.ok(result.candidates.some((item) => item.previewSentence?.includes('tender answer')));
    assert.equal(result.sources.every((source) => source.available), true);
  } finally { global.fetch = oldFetch; }
});

test('lexical lookup reports source outage instead of inventing synonyms', async () => {
  const oldFetch = global.fetch;
  global.fetch = async () => { throw new Error('network unavailable'); };
  try {
    await assert.rejects(() => lookupWordChoice('gentle'), /will not fabricate lexical results/i);
  } finally { global.fetch = oldFetch; }
});
