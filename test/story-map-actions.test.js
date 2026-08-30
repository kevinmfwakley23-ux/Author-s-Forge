import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Story Map scene cards have a real open-scene action", async () => {
  const script = await readFile("public/forge-story-map.js", "utf8");
  assert.match(script, /data-open-scene/);
  assert.match(script, /function openScene\(bookId, chapterId, sceneId\)/);
  assert.match(script, /location\.hash = "#manuscript"/);
  assert.match(script, /forge:story-map-open-scene/);
  assert.match(script, /edit-source-book/);
  assert.match(script, /edit-source-scene/);
});
