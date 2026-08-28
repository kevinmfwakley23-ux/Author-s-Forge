import test from "node:test";
import assert from "node:assert/strict";
import { SemanticCache, stableCacheKey } from "../dist/application/semantic-cache.js";

test("SemanticCache reuses values and refreshes recency", () => {
  const cache = new SemanticCache({ maxEntries: 2 });
  cache.set("a", "A", 1);
  cache.set("b", "B", 2);
  assert.equal(cache.get("a", 3), "A");
  cache.set("c", "C", 4);
  assert.equal(cache.get("b", 5), undefined);
  assert.equal(cache.get("a", 5), "A");
  assert.equal(cache.get("c", 5), "C");
});

test("SemanticCache expires entries by TTL", () => {
  const cache = new SemanticCache({ ttlMs: 10 });
  cache.set("a", "A", 100);
  assert.equal(cache.get("a", 109), "A");
  assert.equal(cache.get("a", 110), undefined);
});

test("stableCacheKey distinguishes ordered request components", () => {
  const first = stableCacheKey(["model", { prompt: "hello", temperature: 0 }]);
  const second = stableCacheKey(["model", { prompt: "hello", temperature: 1 }]);
  assert.notEqual(first, second);
  assert.equal(stableCacheKey(["a", "b"]), stableCacheKey(["a", "b"]));
});
