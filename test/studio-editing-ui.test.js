import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Editing Room proposal surface is wired to the real governed endpoint", async () => {
  const source = await readFile(new URL("../public/forge-editing-proposals.js", import.meta.url), "utf8");
  assert.match(source, /\/ai\/editing\/propose/);
  assert.match(source, /data-edit-approve/);
  assert.match(source, /data-edit-reject/);
  assert.match(source, /data-edit-apply/);
  assert.match(source, /author (?:review|approval)/i);
});
