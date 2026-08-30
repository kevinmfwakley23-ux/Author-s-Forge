import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileAiProposalStore } from "../dist/infrastructure/file-ai-proposal-store.js";

test("file-backed AI proposal ledger survives a fresh process boundary", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forge-proposals-"));
  const path = join(directory, "ai-proposals.json");
  try {
    const first = new FileAiProposalStore(path);
    const store = await first.load();
    const created = store.propose({
      id: "proposal-1",
      projectId: "project-1",
      kind: "manuscript-edit",
      title: "Tighten opening",
      rationale: "Remove repetition without changing canon.",
      proposedContent: "The door opened. Cold air entered.",
      sourceMemoryIds: ["canon-1", "canon-1"],
      now: "2026-08-30T04:00:00.000Z",
    });
    await first.save();
    assert.equal(created.status, "pending");

    const persisted = JSON.parse(await readFile(path, "utf8"));
    assert.equal(persisted.formatVersion, 1);
    assert.equal(persisted.proposals.length, 1);

    const second = new FileAiProposalStore(path);
    const restored = await second.load();
    assert.deepEqual(restored.get("proposal-1"), created);
    assert.equal(restored.pending("project-1").length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("file-backed AI proposal ledger rejects corrupt or unsupported state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forge-proposals-invalid-"));
  const path = join(directory, "ai-proposals.json");
  try {
    await import("node:fs/promises").then(({ writeFile }) => writeFile(path, JSON.stringify({ formatVersion: 99, proposals: [] })));
    const store = new FileAiProposalStore(path);
    await assert.rejects(() => store.load(), /Unsupported or corrupt AI proposal store/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("restoring into a populated proposal store is refused", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forge-proposals-populated-"));
  const path = join(directory, "ai-proposals.json");
  try {
    const store = new FileAiProposalStore(path);
    const ledger = await store.load();
    ledger.propose({ id: "p1", projectId: "project-1", kind: "memory", title: "Candidate", rationale: "Test", proposedContent: "Content", sourceMemoryIds: [] });
    assert.throws(() => ledger.restore([]), /already populated/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
