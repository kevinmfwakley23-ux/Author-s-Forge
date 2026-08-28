const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawn } = require("node:child_process");

function waitForServer(child, port) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Studio server did not start within 5 seconds.")), 5000);
    const onData = (chunk) => {
      if (String(chunk).includes("Author's Forge Studio:")) { clearTimeout(timeout); child.stdout.off("data", onData); resolve(); }
    };
    child.stdout.on("data", onData);
    child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Studio server exited before startup: ${code}`)); });
    void port;
  });
}

test("Forge Studio exposes a real persistent author workflow", async () => {
  const port = 4300 + Math.floor(Math.random() * 500);
  const dataDir = await mkdtemp(join(tmpdir(), "authors-forge-test-"));
  const child = spawn(process.execPath, ["dist/studio-server.js"], { env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", FORGE_DATA_DIR: dataDir, OPENAI_API_KEY: "", OPENAI_MODEL: "" }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    await waitForServer(child, port);
    const base = `http://127.0.0.1:${port}`;
    const get = async (path) => { const response = await fetch(`${base}${path}`); const payload = await response.json(); assert.equal(response.ok, true, `${path}: ${JSON.stringify(payload)}`); return payload; };
    const send = async (path, method, value) => { const response = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(value) }); const payload = await response.json(); assert.equal(response.ok, true, `${method} ${path}: ${JSON.stringify(payload)}`); return payload; };
    const health = await get("/api/health");
    assert.equal(health.ok, true);
    const workspace = await get("/api/projects/forge-studio/workspace");
    assert.equal(workspace.books.length, 0);
    await send("/api/projects/forge-studio/workspace/books", "POST", { id: "book-test", title: "Integration Book", kind: "memoir" });
    await send("/api/projects/forge-studio/workspace/books/book-test/chapters", "POST", { id: "chapter-test", number: 1, title: "Opening" });
    await send("/api/projects/forge-studio/workspace/books/book-test/chapters/chapter-test/scenes", "POST", { id: "scene-test", number: 1, title: "First Scene" });
    await send("/api/projects/forge-studio/workspace/books/book-test/chapters/chapter-test/scenes/scene-test/content", "PUT", { content: "A durable manuscript scene written through the Studio." });
    const restored = await get("/api/projects/forge-studio/workspace");
    assert.equal(restored.books[0].chapters[0].scenes[0].content, "A durable manuscript scene written through the Studio.");
    assert.ok(restored.books[0].chapters[0].scenes[0].wordCount > 0);
    const html = await fetch(`${base}/`).then((response) => response.text());
    assert.match(html, /id="writing"/);
    assert.match(html, /id="export-form"/);

    const pkg = await get("/api/projects/forge-studio/package");
    assert.equal(pkg.manifest.formatVersion, 2);
    assert.equal(pkg.manifest.packageName, "AUTHOR'S FORGE PROJECT");
    assert.deepEqual(pkg.manifest.paths, ["project-state.json"]);
    assert.equal(pkg.projectState.project.metadata.id, "forge-studio");
    assert.equal(pkg.projectState.studioWorkspace.books[0].chapters[0].scenes[0].content, "A durable manuscript scene written through the Studio.");
    assert.equal(pkg.files[0].path, "project-state.json");
    assert.equal(pkg.files[0].mediaType, "application/json");
    assert.match(pkg.files[0].sha256, /^[a-f0-9]{64}$/);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
});
