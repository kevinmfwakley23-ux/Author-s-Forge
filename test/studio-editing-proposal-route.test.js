import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const projectId = `editing-route-${Date.now()}`;
const port = 5600 + Math.floor(Math.random() * 200);

async function waitFor(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

test("Studio exposes the governed AI editing proposal route and validates finding ranges", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-editing-route-"));
  const server = spawn(process.execPath, ["dist/studio-server.js"], {
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    await waitFor(`${base}/api/health`);
    const created = await fetch(`${base}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: projectId, title: "Editing Route Test", kind: "novel" }),
    });
    assert.equal(created.status, 201);

    const book = await fetch(`${base}/api/projects/${projectId}/workspace/books`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Test Book", kind: "novel", description: "Editing proposal route" }),
    }).then((r) => r.json());
    const chapter = await fetch(`${base}/api/projects/${projectId}/workspace/books/${book.id}/chapters`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ number: 1, title: "Opening", synopsis: "Opening" }),
    }).then((r) => r.json());
    const chapterWithScene = await fetch(`${base}/api/projects/${projectId}/workspace/books/${book.id}/chapters/${chapter.id}/scenes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ number: 1, title: "Scene", synopsis: "Scene" }),
    }).then((r) => r.json());
    const scene = chapterWithScene.scenes.at(-1);
    assert.ok(scene?.id);

    const contentResponse = await fetch(`${base}/api/projects/${projectId}/workspace/books/${book.id}/chapters/${chapter.id}/scenes/${scene.id}/content`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "A real scene gives the editing boundary source text to validate." }),
    });
    assert.equal(contentResponse.status, 200);

    const response = await fetch(`${base}/api/projects/${projectId}/ai/editing/propose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookId: book.id,
        chapterId: chapter.id,
        sceneId: scene.id,
        findingMessage: "Weak opening",
        recommendation: "Increase tension",
        findingStart: 0,
        findingEnd: 999,
        proposalId: "invalid-editing-proposal",
      }),
    });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(payload.error, /finding range is invalid/);
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.exitCode !== null ? resolve() : server.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
});
