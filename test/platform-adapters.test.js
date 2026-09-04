"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const doctor = path.join(root, "scripts", "forge-platform-doctor.js");
const sandbox = path.join(root, "scripts", "forge-sandbox.js");

test("platform doctor emits machine-readable real capability state", () => {
  const result = spawnSync(process.execPath, [doctor, "--json"], { cwd: root, encoding: "utf8", timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(typeof report.generatedAt, "string");
  assert.equal(report.host.platform, process.platform);
  assert.equal(report.host.arch, process.arch);
  assert.equal(report.tools.node.available, true);
  assert.equal(report.capabilities.forgeRuntime, report.tools.node.available && report.tools.npm.available);
  assert.match(report.truth, /does not simulate/i);
});

test("sandbox refuses to pretend it ran when no container runtime is available", () => {
  const env = { ...process.env, PATH: "" };
  const result = spawnSync(process.execPath, [sandbox, "--", "printf", "sandbox-should-not-run"], {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /sandbox-should-not-run/);
  assert.match(result.stderr, /Docker or Podman is required/);
});

test("sandbox rejects unsupported control options before execution", () => {
  const result = spawnSync(process.execPath, [sandbox, "--unsafe-host-fallback", "--", "echo", "no"], {
    cwd: root,
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unsupported option/i);
});
