import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Story Map UI is a live durable-workspace surface", async () => {
  const script = await readFile("public/forge-story-map.js", "utf8");
  const chapterCards = await readFile("public/forge-chapter-cards.js", "utf8");
  const extension = await readFile("public/forge-editing-proposals.js", "utf8");
  const pwa = await readFile("public/forge-pwa.js", "utf8");
  const sw = await readFile("public/sw.js", "utf8");
  assert.match(script, /forgeWorkspaceState/);
  assert.match(script, /data-route="story-map"/);
  assert.match(script, /data-open-scene/);
  assert.match(script, /story-map-timeline/);
  assert.match(script, /story-map-scenes/);
  assert.match(script, /lifecycle === "complete"/);
  assert.match(extension, /\/forge-story-map\.js/);

  assert.match(chapterCards, /data-plan-chapter/);
  assert.match(chapterCards, /Save Chapter Card/);
  assert.match(chapterCards, /forbiddenDeviations/);
  assert.match(chapterCards, /approximateWordCount/);
  assert.match(chapterCards, /\/story-map\/chapters\/\$\{encodeURIComponent\(selected\.bookId\)\}\/\$\{encodeURIComponent\(selected\.chapterId\)\}\/card/);
  assert.match(chapterCards, /Manuscript prose, chapter title, and scene order were not changed/);
  assert.match(chapterCards, /observer\.observe\(host, \{ childList: true \}\)/, "Chapter Card decoration must not observe its own nested mutations.");
  assert.doesNotMatch(chapterCards, /observer\.observe\(host, \{ childList: true, subtree: true \}\)/, "Nested Story Map observation can self-trigger decoration/fetch loops.");
  assert.match(chapterCards, /rootObserver\.disconnect\(\)/, "Dynamic-surface discovery observer must disconnect once Story Map exists.");
  assert.match(pwa, /loadExtension\("chapter-cards","\/forge-chapter-cards\.js"\)/);

  assert.match(sw, /\/forge-story-map\.js/);
  assert.match(sw, /\/forge-chapter-cards\.js/);
  assert.match(sw, /const CACHE = "authors-forge-shell-v\d+"/);
  assert.doesNotMatch(sw, /url\.pathname\.startsWith\("\/api\/"\).*cache/);
});
