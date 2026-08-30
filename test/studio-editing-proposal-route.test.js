import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = 5600 + Math.floor(Math.random() * 200);
async function waitFor(url, timeoutMs = 10000) { const started = Date.now(); while (Date.now() - started < timeoutMs) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error(`Timed out waiting for ${url}`); }
async function readJson(response, label) { const raw = await response.text(); assert.ok(raw.trim(), `${label}: expected a JSON response body`); return JSON.parse(raw); }

test("Studio exposes the governed AI editing proposal route and validates finding ranges", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-editing-route-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], { env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "" }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    const base = `http://127.0.0.1:${port}`;
    await waitFor(`${base}/api/health`);
    const bookResponse = await fetch(`${base}/api/projects/forge-studio/workspace/books`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "editing-route-book", title: "Editing Route Test", kind: "novel", description: "Editing proposal route" }) });
    assert.equal(bookResponse.status, 201);
    const book = await readJson(bookResponse, "create book");
    const chapterResponse = await fetch(`${base}/api/projects/forge-studio/workspace/books/${book.id}/chapters`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "editing-route-chapter", number: 1, title: "Opening", synopsis: "Opening" }) });
    assert.equal(chapterResponse.status, 201);
    const chapter = await readJson(chapterResponse, "create chapter");
    const sceneResponse = await fetch(`${base}/api/projects/forge-studio/workspace/books/${book.id}/chapters/${chapter.id}/scenes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "editing-route-scene", number: 1, title: "Scene", synopsis: "Scene" }) });
    assert.equal(sceneResponse.status, 201);
    const chapterWithScene = await readJson(sceneResponse, "create scene");
    const scene = chapterWithScene.scenes.at(-1);
    assert.ok(scene?.id);
    const sourceContent = "A real scene gives the editing boundary source text to validate.";
    const contentResponse = await fetch(`${base}/api/projects/forge-studio/workspace/books/${book.id}/chapters/${chapter.id}/scenes/${scene.id}/content`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: sourceContent }) });
    assert.equal(contentResponse.status, 200);
    const response = await fetch(`${base}/api/projects/forge-studio/ai/editing/propose`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookId: book.id, chapterId: chapter.id, sceneId: scene.id, findingMessage: "Weak opening", recommendation: "Increase tension", findingStart: 0, findingEnd: sourceContent.length + 1, proposalId: "invalid-editing-proposal" }) });
    assert.equal(response.status, 400);
    const raw = await response.text();
    if (raw.trim()) assert.match(String(JSON.parse(raw).error ?? JSON.parse(raw).message ?? ""), /finding range is invalid/i);
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
});
