const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const client = readFileSync("public/forge-publishing-promotion.js", "utf8");
const children = readFileSync("public/forge-children-topics.js", "utf8");
const server = readFileSync("src/studio-server.ts", "utf8");
const routes = readFileSync("src/application/studio-publishing-promotion-routes.ts", "utf8");

test("canonical Studio loads the Publishing and Promotion client and server routes", () => {
  assert.match(children, /forge-publishing-promotion\.js/);
  assert.match(children, /ensurePublishingPromotionClient/);
  assert.match(server, /createStudioPublishingPromotionRoutes/);
  assert.match(server, /publishingPromotionRoutes\(req,res,url,projectId\)/);
  assert.match(routes, /\/publishing\/metadata/);
  assert.match(routes, /\/publishing\/readiness/);
  assert.match(routes, /\/market-research/);
  assert.match(routes, /\/promotion\/generate/);
  assert.match(routes, /\/promotion\/readiness/);
  assert.match(routes, /\/release-gate/);
});

test("author-visible market workflow caps KDP selection at seven and requires confirmation before metadata mutation", () => {
  assert.match(client, /selected\.length>7/);
  assert.match(client, /KDP supports up to seven keyword phrases/);
  assert.match(client, /window\.confirm\(`Apply/);
  assert.match(client, /authorApproved:true/);
  assert.match(routes, /Explicit author approval is required before applying researched keywords/);
});

test("Promotion client preserves draft-review authority and explicit publication confirmation", () => {
  assert.match(client, /Generate real AI campaign/);
  assert.match(client, /Nothing self-approves or self-publishes/);
  assert.match(client, /window\.confirm\('Confirm that this asset was actually published externally/);
  assert.match(routes, /authorApproved: input\.authorApproved === true/);
});

test("market statistics visibly disclaim unit-sales inference", () => {
  assert.match(client, /they are not unit-sales estimates/);
  assert.match(client, /does not convert BSR\/reviews into fake sales numbers/);
});