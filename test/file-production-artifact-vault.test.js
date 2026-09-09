const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const { ManuscriptProductionService } = require("../.forge-build/application/manuscript-production.js");
const { productionSourceSha256 } = require("../.forge-build/domain/production-artifact-evidence.js");
const { FileProductionArtifactVault } = require("../.forge-build/infrastructure/file-production-artifact-vault.js");

const options = {
  format: "epub",
  pageSize: "6x9",
  pageNumbers: true,
  includeTitlePage: true,
  includeToc: true,
};

function build(now = "2026-09-08T19:00:00.000Z") {
  const manuscript = {
    projectId: "project-artifact-vault",
    bookId: "book-artifact-vault",
    title: "Artifact Vault",
    author: "Forge Author",
    chapters: [{
      id: "chapter-1",
      number: 1,
      title: "Chapter One",
      scenes: [{ id: "scene-1", title: "Scene One", body: "Durable production bytes must survive restart and tamper checks." }],
    }],
    frontMatter: [],
    backMatter: [],
  };
  const artifact = new ManuscriptProductionService().render(manuscript, options, now);
  return { manuscript, artifact, sourceSha256: productionSourceSha256(manuscript, options) };
}

test("production artifact vault persists real bytes and source identity after restart", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-production-vault-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const generated = build();
  const first = new FileProductionArtifactVault(root);
  const evidence = await first.save(generated.artifact, options, generated.sourceSha256);

  assert.equal(evidence.sha256, generated.artifact.sha256);
  assert.equal(evidence.sourceSha256, generated.sourceSha256);
  assert.equal(evidence.byteLength, generated.artifact.byteLength);
  const restarted = new FileProductionArtifactVault(root);
  const records = await restarted.list("project-artifact-vault", { bookId: "book-artifact-vault", formats: ["epub"] });
  assert.equal(records.length, 1);
  const verified = await restarted.verify(records[0]);
  assert.equal(verified.valid, true, verified.issues.join("; "));
  const latest = await restarted.latestVerified("project-artifact-vault", "book-artifact-vault", ["epub"]);
  assert.ok(latest);
  assert.equal(latest.evidence.artifactId, generated.artifact.id);
});

test("same-instant production exports use distinct durable files and manifests", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-production-vault-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const generated = build("2026-09-08T19:00:30.000Z");
  const vault = new FileProductionArtifactVault(root);
  const first = await vault.save(generated.artifact, options, generated.sourceSha256);
  const second = await vault.save(generated.artifact, options, generated.sourceSha256);

  assert.equal(first.artifactId, second.artifactId, "renderer identity intentionally demonstrates the collision case");
  assert.notEqual(first.storageFileName, second.storageFileName, "durable files must not overwrite one another");
  const records = await vault.list(generated.artifact.projectId, { bookId: generated.artifact.bookId, formats: ["epub"] });
  assert.equal(records.length, 2, "both same-instant exports must retain independent manifests");
  for (const record of records) {
    const verified = await vault.verify(record);
    assert.equal(verified.valid, true, verified.issues.join("; "));
  }
});

test("production artifact vault detects byte tampering instead of trusting the manifest", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-production-vault-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const generated = build("2026-09-08T19:01:00.000Z");
  const vault = new FileProductionArtifactVault(root);
  const evidence = await vault.save(generated.artifact, options, generated.sourceSha256);
  const path = join(root, "projects", generated.artifact.projectId, "production", evidence.storageFileName);
  const bytes = await readFile(path);
  bytes[bytes.length - 1] = bytes[bytes.length - 1] ^ 0xff;
  await writeFile(path, bytes);

  const verification = await vault.verify(evidence);
  assert.equal(verification.valid, false);
  assert.ok(verification.issues.some((issue) => /SHA-256/.test(issue)), verification.issues.join("; "));
  const latest = await vault.latestVerified(generated.artifact.projectId, generated.artifact.bookId, ["epub"]);
  assert.equal(latest, undefined, "tampered artifact must not remain eligible for release readiness");
});

test("production artifact vault refuses a missing or fabricated source fingerprint", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "forge-production-vault-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const generated = build("2026-09-08T19:02:00.000Z");
  const vault = new FileProductionArtifactVault(root);
  await assert.rejects(() => vault.save(generated.artifact, options, "not-a-real-source-hash"), /source SHA-256/i);
  const records = await vault.list(generated.artifact.projectId, { bookId: generated.artifact.bookId });
  assert.equal(records.length, 0, "failed evidence creation must not leave a production file behind");
});
