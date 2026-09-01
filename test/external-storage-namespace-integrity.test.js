const assert = require("node:assert/strict");
const test = require("node:test");
const {
  STORAGE_PROVIDER_IDS,
  createProjectStorageBinding,
  validateProjectStorageBinding,
  createDownloadableProjectPackageFilename,
  normalizeStorageKey,
  MemoryStorageProvider,
} = require("../.forge-build/domain/external-storage.js");
const { ExternalStorageService } = require("../.forge-build/application/external-storage.js");

function bytes(text) { return new TextEncoder().encode(text); }

test("external storage runtime contract validates provider, project id and normalized namespace", () => {
  assert.equal(Object.isFrozen(STORAGE_PROVIDER_IDS), true);
  assert.throws(() => createProjectStorageBinding({ projectId: "../p1", providerId: "download" }), /project id contains unsupported/i);
  assert.throws(() => createProjectStorageBinding({ projectId: "p1", providerId: "unknown" }), /unsupported storage provider/i);
  assert.throws(() => createProjectStorageBinding({ projectId: "p1", providerId: "download", keyPrefix: "../escape" }), /normalized relative storage path/i);
  assert.throws(() => validateProjectStorageBinding({ formatVersion: 1, projectId: "p1", providerId: "unknown", keyPrefix: "projects/p1", sourceOfTruth: "forge-project" }), /unsupported storage provider/i);
  assert.deepEqual(createProjectStorageBinding({ projectId: "p1", providerId: "download" }), {
    formatVersion: 1,
    projectId: "p1",
    providerId: "download",
    keyPrefix: "projects/p1",
    sourceOfTruth: "forge-project",
  });
});

test("storage key normalization rejects traversal, backslashes, ambiguous segments and control characters", () => {
  for (const key of ["../backup.json", "a/../backup.json", "/absolute.json", "a\\backup.json", "a//backup.json", "a/./backup.json", "a/ backup.json", "a/backup.json/", "a/\u0000backup.json"]) {
    assert.throws(() => normalizeStorageKey(key), /normalized relative storage path/i, key);
  }
  assert.equal(normalizeStorageKey("recovery/backup.forge-project.json"), "recovery/backup.forge-project.json");
});

test("downloadable Forge package filename cannot become a path", () => {
  assert.equal(createDownloadableProjectPackageFilename("book_01"), "book_01.forge-project.json");
  assert.throws(() => createDownloadableProjectPackageFilename("../book"), /unsupported characters/i);
  assert.throws(() => createDownloadableProjectPackageFilename("book/one"), /unsupported characters/i);
});

test("ExternalStorageService scopes put/get/list/delete under one validated project prefix", async () => {
  const provider = new MemoryStorageProvider();
  const service = new ExternalStorageService(provider);
  const p1 = createProjectStorageBinding({ projectId: "p1", providerId: "download" });
  const p10 = createProjectStorageBinding({ projectId: "p10", providerId: "download" });

  await service.put(p1, "recovery/one.json", bytes("one"), "application/json");
  await service.put(p10, "recovery/ten.json", bytes("ten"), "application/json");
  assert.equal(new TextDecoder().decode(await service.get(p1, "recovery/one.json")), "one");
  assert.deepEqual((await service.list(p1)).map((item) => item.key), ["projects/p1/recovery/one.json"]);
  assert.deepEqual((await service.list(p10)).map((item) => item.key), ["projects/p10/recovery/ten.json"]);

  await service.delete(p1, "recovery/one.json");
  await assert.rejects(() => service.get(p1, "recovery/one.json"), /was not found/i);
  assert.equal((await service.list(p10)).length, 1);
});

test("ExternalStorageService rejects unsafe suffixes before calling the provider", async () => {
  const calls = [];
  const provider = {
    id: "download",
    async put(key) { calls.push(["put", key]); return { key, size: 0, mediaType: "application/octet-stream", updatedAt: "2026-09-01T00:00:00.000Z" }; },
    async get(key) { calls.push(["get", key]); return new Uint8Array(); },
    async delete(key) { calls.push(["delete", key]); },
    async list(prefix) { calls.push(["list", prefix]); return []; },
  };
  const service = new ExternalStorageService(provider);
  const binding = createProjectStorageBinding({ projectId: "p1", providerId: "download" });

  await assert.rejects(() => service.put(binding, "../escape", new Uint8Array(), "application/json"), /normalized relative storage path/i);
  await assert.rejects(() => service.get(binding, "a\\escape"), /normalized relative storage path/i);
  await assert.rejects(() => service.delete(binding, "a/../escape"), /normalized relative storage path/i);
  await assert.rejects(() => service.list(binding, "../escape"), /normalized relative storage path/i);
  assert.deepEqual(calls, []);
});
