import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Story Map UI is a live durable-workspace surface", async () => {
  const script = await readFile("public/forge-story-map.js", "utf8");
  const extension = await readFile("public/forge-editing-proposals.js", "utf8");
  const sw = await readFile("public/sw.js", "utf8");
  assert.match(script, /forgeWorkspaceState/);
  assert.match(script, /data-route="story-map"/);
  assert.match(script, /data-open-scene/);
  assert.match(script, /story-map-timeline/);
  assert.match(script, /story-map-scenes/);
  assert.match(script, /lifecycle === "complete"/);
  assert.match(extension, /\/forge-story-map\.js/);
  assert.match(sw, /\/forge-story-map\.js/);
  assert.match(sw, /authors-forge-shell-v5/);
  assert.doesNotMatch(sw, /url\.pathname\.startsWith\("\/api\/"\).*cache/);
});
