#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

function fail(message) {
  console.error(`Forge sandbox: ${message}`);
  process.exit(1);
}

function findRuntime() {
  for (const runtime of ["docker", "podman"]) {
    const probe = spawnSync(runtime, ["--version"], { encoding: "utf8", timeout: 5000, windowsHide: true });
    if (!probe.error && probe.status === 0) return runtime;
  }
  return null;
}

const args = process.argv.slice(2);
const separator = args.indexOf("--");
if (separator === -1 || separator === args.length - 1) {
  fail("usage: node scripts/forge-sandbox.js [--write] [--network] [--image=<image>] [--memory=<limit>] [--cpus=<n>] -- <command...>");
}

const options = args.slice(0, separator);
const command = args.slice(separator);
const write = options.includes("--write");
const network = options.includes("--network");
const image = options.find((arg) => arg.startsWith("--image="))?.slice("--image=".length) || "node:24-bookworm";
const memory = options.find((arg) => arg.startsWith("--memory="))?.slice("--memory=".length) || "2g";
const cpus = options.find((arg) => arg.startsWith("--cpus="))?.slice("--cpus=".length) || "2";

for (const option of options) {
  if (!["--write", "--network"].includes(option) && !/^--(image|memory|cpus)=/.test(option)) fail(`unsupported option: ${option}`);
}
if (!/^[a-zA-Z0-9._/:@-]+$/.test(image)) fail("image contains unsupported characters");
if (!/^[0-9]+(?:[kKmMgG])?$/.test(memory)) fail("memory must look like 512m, 2g, or 2048m");
if (!/^[0-9]+(?:\.[0-9]+)?$/.test(cpus) || Number(cpus) <= 0 || Number(cpus) > 32) fail("cpus must be between 0 and 32");

const runtime = findRuntime();
if (!runtime) fail("Docker or Podman is required for the disposable sandbox. Forge will not silently run the command on the host.");

const repo = fs.realpathSync(process.cwd());
const mount = `${repo}:/workspace${write ? "" : ":ro"}`;
const runtimeArgs = [
  "run", "--rm", "--init",
  "--workdir", "/workspace",
  "--memory", memory,
  "--cpus", cpus,
  "--pids-limit", "256",
  "--security-opt", "no-new-privileges",
  "--cap-drop", "ALL",
  "--network", network ? "bridge" : "none",
  "--mount", `type=bind,src=${repo},dst=/workspace${write ? "" : ",readonly"}`,
  "--tmpfs", "/tmp:rw,noexec,nosuid,size=512m",
  image,
  "bash", "-lc", command.map(shellQuote).join(" "),
];

console.log(`Forge sandbox runtime: ${runtime}`);
console.log(`Workspace: ${repo} (${write ? "read-write" : "read-only"})`);
console.log(`Network: ${network ? "enabled by explicit request" : "disabled"}`);
console.log(`Image: ${image}`);

const result = spawnSync(runtime, runtimeArgs, { stdio: "inherit", windowsHide: false });
if (result.error) fail(result.error.message);
process.exit(result.status ?? 1);

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}
