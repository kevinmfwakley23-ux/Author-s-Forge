const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createPortableProjectReference,
  createRuntimeCheckpoint,
  hasCapability
} = require("../.forge-build/domain/runtime.js");
const {
  createRuntimeContext,
  markRuntimeInterrupted,
  requireCapabilities
} = require("../.forge-build/application/runtime.js");

test("runtime identity and device identity remain platform-neutral", () => {
  const context = createRuntimeContext({
    runtime: { id: "runtime-phone", kind: "web-mobile", connectivity: "online" },
    device: { id: "device-1", class: "phone", platform: "android" },
    capabilities: [
      { capability: "storage", available: true },
      { capability: "audio-capture", available: true },
      { capability: "network", available: true }
    ]
  });

  assert.equal(context.runtime.kind, "web-mobile");
  assert.equal(context.device.class, "phone");
  assert.equal(hasCapability(context, "audio-capture"), true);
  assert.equal(hasCapability(context, "clipboard"), false);
});

test("portable project identity is independent of a device-local path", () => {
  const reference = createPortableProjectReference("better-question", 1);
  assert.deepEqual(reference, {
    projectId: "better-question",
    formatVersion: 1,
    canonicalLocation: "portable-project"
  });
  assert.equal("path" in reference, false);
});

test("required capabilities are governed explicitly", () => {
  const context = createRuntimeContext({
    runtime: { id: "desktop-1", kind: "web-desktop", connectivity: "online" },
    device: { id: "device-2", class: "desktop", platform: "linux" },
    capabilities: [
      { capability: "storage", available: true },
      { capability: "display", available: true }
    ]
  });

  requireCapabilities(context, ["storage", "display"]);
  assert.throws(() => requireCapabilities(context, ["storage", "audio-capture"]), /audio-capture/);
});

test("runtime interruption becomes recoverable checkpoint state", () => {
  const checkpoint = markRuntimeInterrupted("better-question", "runtime-1", "2026-01-01T00:00:00.000Z");
  assert.equal(checkpoint.status, "interrupted");
  assert.equal(checkpoint.projectId, "better-question");
  assert.equal(checkpoint.runtimeId, "runtime-1");
});

test("recoverable checkpoints retain no platform-specific path", () => {
  const checkpoint = createRuntimeCheckpoint({
    projectId: "journal-001",
    status: "recoverable",
    savedAt: "2026-01-02T00:00:00.000Z",
    runtimeId: "desktop-runtime"
  });
  assert.equal("path" in checkpoint, false);
  assert.equal(checkpoint.status, "recoverable");
});
