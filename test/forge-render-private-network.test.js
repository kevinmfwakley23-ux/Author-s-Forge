const test = require("node:test");
const assert = require("node:assert/strict");
const { applyRenderPrivateNetworkEnv, privateHostPort } = require("../scripts/forge-render-private-network");

test("Render private hostport becomes the real K.I.N.G.S. Responses endpoint", () => {
  const env = { KINGS_AI_HOSTPORT: "kings-ai-router:10000" };
  applyRenderPrivateNetworkEnv(env);
  assert.equal(env.KINGS_AI_RESPONSES_URL, "http://kings-ai-router:10000/v1/responses");
});

test("explicit K.I.N.G.S. Responses URL wins over Render private hostport", () => {
  const env = {
    KINGS_AI_HOSTPORT: "kings-ai-router:10000",
    KINGS_AI_RESPONSES_URL: "https://kings.example/v1/responses",
  };
  applyRenderPrivateNetworkEnv(env);
  assert.equal(env.KINGS_AI_RESPONSES_URL, "https://kings.example/v1/responses");
});

test("Render private hostport rejects URL-shaped and invalid values", () => {
  assert.throws(() => privateHostPort("https://kings.example/v1", "KINGS_AI_HOSTPORT"), /host:port format/);
  assert.throws(() => privateHostPort("kings-ai-router:not-a-port", "KINGS_AI_HOSTPORT"), /numeric port/);
  assert.throws(() => privateHostPort("kings-ai-router:70000", "KINGS_AI_HOSTPORT"), /1 to 65535/);
});
