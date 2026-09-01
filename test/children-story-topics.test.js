const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const catalog = JSON.parse(readFileSync("public/children-story-topics.json", "utf8"));
const client = readFileSync("public/forge-children-topics.js", "utf8");
const recovery = readFileSync("public/forge-recovery.js", "utf8");

test("children's story catalog contains 100 unique source-informed topics", () => {
  assert.equal(catalog.formatVersion, 1);
  assert.equal(catalog.maxItems, 100);
  assert.equal(catalog.categories.length, 10);
  const topics = catalog.categories.flatMap((category) => category.topics);
  assert.equal(topics.length, 100);
  assert.equal(new Set(topics).size, 100);
  assert.ok(catalog.categories.every((category) => category.topics.length === 10));
  assert.match(catalog.intendedUse, /not a diagnostic tool/i);
  assert.match(catalog.heartwoodGuidance, /Heartwood Jungle/i);
});

test("catalog source references resolve and every category has evidence metadata", () => {
  const sourceIds = new Set(catalog.sourceBasis.map((source) => source.id));
  assert.equal(sourceIds.size, catalog.sourceBasis.length);
  assert.ok(catalog.sourceBasis.every((source) => /^https:\/\//.test(source.url)));
  for (const category of catalog.categories) {
    assert.ok(category.sourceIds.length > 0, `${category.id} has no source basis`);
    assert.ok(category.sourceIds.every((id) => sourceIds.has(id)), `${category.id} contains an unknown source id`);
    assert.ok(category.framing.length > 20, `${category.id} lacks gentle framing guidance`);
  }
});

test("Command Center topic discovery caps output at 100 and stays provider-independent", () => {
  assert.match(client, /Math\.min\(100/);
  assert.match(client, /topics\.length !== 100/);
  assert.match(client, /forgeChildrenStoryTopics/);
  assert.match(client, /heartwood/i);
  assert.match(client, /children-story-topics\.json/);
  assert.doesNotMatch(client, /\/api\/projects\/.*ai\//);
  assert.doesNotMatch(client, /OPENAI|OLLAMA|KINGS_AI_ENDPOINT/);
});

test("existing Studio extension boundary loads child topic discovery without replacing recovery", () => {
  assert.match(recovery, /ensureChildrenStoryTopicsClient/);
  assert.match(recovery, /forge-children-topics\.js/);
  assert.match(recovery, /package\/restore/);
});
