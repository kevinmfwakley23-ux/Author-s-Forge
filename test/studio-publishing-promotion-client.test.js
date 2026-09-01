const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const client = readFileSync("public/forge-publishing-promotion.js", "utf8");
const performanceClient = readFileSync("public/forge-promotion-performance.js", "utf8");
const children = readFileSync("public/forge-children-topics.js", "utf8");
const server = readFileSync("src/studio-server.ts", "utf8");
const routes = readFileSync("src/application/studio-publishing-promotion-routes.ts", "utf8");

test("canonical Studio loads Publishing, Promotion, performance and server routes", () => {
  assert.match(children, /forge-publishing-promotion\.js/);
  assert.match(children, /ensurePublishingPromotionClient/);
  assert.match(children, /forge-promotion-performance\.js/);
  assert.match(children, /ensurePromotionPerformanceClient/);
  assert.match(server, /createStudioPublishingPromotionRoutes/);
  assert.match(server, /publishingPromotionRoutes\(req,res,url,projectId\)/);
  assert.match(routes, /\/publishing\/metadata/);
  assert.match(routes, /\/publishing\/readiness/);
  assert.match(routes, /\/market-research/);
  assert.match(routes, /\/promotion\/generate/);
  assert.match(routes, /\/promotion\/readiness/);
  assert.match(routes, /\/promotion\/performance/);
  assert.match(routes, /\/release-gate/);
});

test("author-visible market workflow caps KDP selection at seven and requires confirmation before metadata mutation", () => {
  assert.match(client, /selected\.length<=7/);
  assert.match(client, /this\.checked=false/);
  assert.match(client, /phrases\.length>7/);
  assert.match(client, /KDP supports up to seven keyword phrases/);
  assert.match(client, /window\.confirm\(`Apply/);
  assert.match(client, /authorApproved:true/);
  assert.match(routes, /Explicit author approval is required before applying researched keywords/);
});

test("Publishing readiness is edition-scoped and server-owned illustration truth cannot be fabricated by the client", () => {
  assert.match(client, /name="releaseFormat"/);
  assert.match(client, /format=\$\{encodeURIComponent\(format\)\}/);
  assert.match(routes, /project\.illustrationAssetLibrary\?\.assets/);
  assert.match(routes, /count: bookAssets\.length/);
  assert.match(routes, /asset\.approvalStatus === "approved"/);
  assert.match(routes, /report\.releaseFormat === format/);
  assert.doesNotMatch(client, /count:\s*defaultImagesRequired/);
});

test("Promotion client preserves draft-review authority and explicit publication confirmation", () => {
  assert.match(client, /Generate real AI campaign/);
  assert.match(client, /Nothing self-approves or self-publishes/);
  assert.match(client, /window\.confirm\('Confirm that this asset was actually published externally/);
  assert.match(routes, /authorApproved: input\.authorApproved === true/);
});

test("Promotion performance records observed source data and labels attribution limits", () => {
  assert.match(performanceClient, /Record observed performance/);
  assert.match(performanceClient, /Attributed revenue/);
  assert.match(performanceClient, /never substitutes unrelated retailer sales/);
  assert.match(performanceClient, /\/promotion\/performance/);
  assert.match(performanceClient, /ACOS/);
  assert.match(performanceClient, /ROAS/);
});

test("market statistics visibly disclaim unit-sales inference", () => {
  assert.match(client, /they are not unit-sales estimates/);
  assert.match(client, /does not convert BSR\/reviews into fake sales numbers/);
});
