import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileAiProposalStore } from "../dist/infrastructure/file-ai-proposal-store.js";

function reviewedProposal(overrides = {}) {
  return {
    id: "legacy-reviewed",
    projectId: "project-legacy",
    kind: "manuscript-edit",
    status: "accepted",
    title: "Legacy reviewed edit",
    rationale: "Historical author decision.",
    proposedContent: "Keep this approved revision.",
    sourceMemoryIds: ["canon-legacy"],
    createdAt: "2026-08-30T04:00:00.000Z",
    reviewedAt: "2026-08-30T04:05:00.000Z",
    reviewedBy: "author",
    reviewNote: "Approved before audit format v2.",
    ...overrides,
  };
}

test("file-backed AI proposal ledger persists proposals and author review audit", async () => {
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
    const decision = store.review("proposal-1", "accepted", "author", "Approved exactly as proposed.", "2026-08-30T04:05:00.000Z");
    await first.save();

    assert.equal(created.status, "pending");
    assert.equal(decision.to, "accepted");
    const persisted = JSON.parse(await readFile(path, "utf8"));
    assert.equal(persisted.formatVersion, 2);
    assert.equal(persisted.proposals.length, 1);
    assert.deepEqual(persisted.reviewAudit, [{
      proposalId: "proposal-1",
      from: "pending",
      to: "accepted",
      reviewer: "author",
      note: "Approved exactly as proposed.",
      reviewedAt: "2026-08-30T04:05:00.000Z",
      sequence: 1,
    }]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("proposal review audit survives a real fresh Node process boundary", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forge-proposals-process-"));
  const path = join(directory, "ai-proposals.json");
  try {
    const childProgram = `
      const { FileAiProposalStore } = require('./dist/infrastructure/file-ai-proposal-store.js');
      (async () => {
        const file = process.env.PROPOSAL_PATH;
        const durable = new FileAiProposalStore(file);
        const ledger = await durable.load();
        ledger.propose({ id: 'process-proposal', projectId: 'process-project', kind: 'memory', title: 'Remember this', rationale: 'Restart evidence', proposedContent: 'Durable proposal content', sourceMemoryIds: [], now: '2026-09-08T18:00:00.000Z' });
        ledger.review('process-proposal', 'rejected', 'author', 'Do not change canon.', '2026-09-08T18:01:00.000Z');
        await durable.save();
      })().catch((error) => { console.error(error); process.exit(1); });
    `;
    const child = spawnSync(process.execPath, ["-e", childProgram], {
      cwd: process.cwd(),
      env: { ...process.env, PROPOSAL_PATH: path },
      encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);

    const fresh = new FileAiProposalStore(path);
    const restored = await fresh.load();
    assert.equal(restored.get("process-proposal")?.status, "rejected");
    assert.deepEqual(restored.audit("process-project"), [{
      proposalId: "process-proposal",
      from: "pending",
      to: "rejected",
      reviewer: "author",
      note: "Do not change canon.",
      reviewedAt: "2026-09-08T18:01:00.000Z",
      sequence: 1,
    }]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy v1 proposal files migrate reviewed author decisions into audit evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forge-proposals-v1-"));
  const path = join(directory, "ai-proposals.json");
  try {
    await writeFile(path, JSON.stringify({
      formatVersion: 1,
      proposals: [reviewedProposal()],
    }, null, 2));

    const durable = new FileAiProposalStore(path);
    const restored = await durable.load();
    assert.deepEqual(restored.audit(), [{
      proposalId: "legacy-reviewed",
      from: "pending",
      to: "accepted",
      reviewer: "author",
      note: "Approved before audit format v2.",
      reviewedAt: "2026-08-30T04:05:00.000Z",
      sequence: 1,
    }]);

    await durable.save();
    const migrated = JSON.parse(await readFile(path, "utf8"));
    assert.equal(migrated.formatVersion, 2);
    assert.equal(migrated.reviewAudit.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("v2 proposal files cannot hide a reviewed decision by omitting its audit entry", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forge-proposals-missing-audit-"));
  const path = join(directory, "ai-proposals.json");
  try {
    await writeFile(path, JSON.stringify({
      formatVersion: 2,
      proposals: [reviewedProposal({ id: "missing-audit" })],
      reviewAudit: [],
    }, null, 2));
    const store = new FileAiProposalStore(path);
    await assert.rejects(() => store.load(), /review audit is missing reviewed proposal/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("v2 proposal files reject audit entries that disagree with the durable proposal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forge-proposals-mismatch-"));
  const path = join(directory, "ai-proposals.json");
  try {
    await writeFile(path, JSON.stringify({
      formatVersion: 2,
      proposals: [reviewedProposal({ id: "mismatch" })],
      reviewAudit: [{
        proposalId: "mismatch",
        from: "pending",
        to: "rejected",
        reviewer: "author",
        note: "Approved before audit format v2.",
        reviewedAt: "2026-08-30T04:05:00.000Z",
        sequence: 1,
      }],
    }, null, 2));
    const store = new FileAiProposalStore(path);
    await assert.rejects(() => store.load(), /review audit does not match proposal/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("file-backed AI proposal ledger rejects corrupt or unsupported state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "forge-proposals-invalid-"));
  const path = join(directory, "ai-proposals.json");
  try {
    await writeFile(path, JSON.stringify({ formatVersion: 99, proposals: [] }));
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
