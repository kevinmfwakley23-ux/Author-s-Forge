#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");

function fail(message) {
  console.error(`Forge Codespaces: ${message}`);
  process.exit(1);
}

function requireGh() {
  const probe = spawnSync("gh", ["--version"], { encoding: "utf8", timeout: 5000, windowsHide: true });
  if (probe.error || probe.status !== 0) fail("GitHub CLI is required. Forge will not pretend Codespaces is available without authenticated `gh` tooling.");
}

function run(args, inherit = true) {
  const result = spawnSync("gh", args, {
    encoding: inherit ? undefined : "utf8",
    stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    windowsHide: false,
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) {
    if (!inherit && result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  if (!inherit && result.stdout) process.stdout.write(result.stdout);
}

function validRepo(value) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

function validName(value) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

requireGh();
const [action, ...args] = process.argv.slice(2);

switch (action) {
  case "list": {
    const repo = valueOf(args, "--repo");
    if (repo && !validRepo(repo)) fail("--repo must be OWNER/REPO");
    const ghArgs = ["codespace", "list", "--json", "name,displayName,repository,state,machineName,lastUsedAt"];
    if (repo) ghArgs.push("--repo", repo);
    run(ghArgs, false);
    break;
  }
  case "create": {
    const repo = valueOf(args, "--repo");
    if (!repo || !validRepo(repo)) fail("create requires --repo OWNER/REPO");
    const branch = valueOf(args, "--branch");
    const machine = valueOf(args, "--machine");
    const idle = valueOf(args, "--idle-timeout") || "30m";
    const name = valueOf(args, "--display-name");
    const ghArgs = ["codespace", "create", "--repo", repo, "--devcontainer-path", ".devcontainer/devcontainer.json", "--idle-timeout", idle];
    if (branch) ghArgs.push("--branch", branch);
    if (machine) ghArgs.push("--machine", machine);
    if (name) ghArgs.push("--display-name", name);
    run(ghArgs);
    break;
  }
  case "run": {
    const codespace = valueOf(args, "--codespace");
    const sep = args.indexOf("--");
    if (!codespace || !validName(codespace)) fail("run requires --codespace NAME");
    if (sep === -1 || sep === args.length - 1) fail("run requires a command after --");
    const command = args.slice(sep + 1);
    run(["codespace", "ssh", "--codespace", codespace, command.map(shellQuote).join(" ")]);
    break;
  }
  case "stop": {
    const codespace = valueOf(args, "--codespace");
    if (!codespace || !validName(codespace)) fail("stop requires --codespace NAME");
    run(["codespace", "stop", "--codespace", codespace]);
    break;
  }
  case "view": {
    const codespace = valueOf(args, "--codespace");
    if (!codespace || !validName(codespace)) fail("view requires --codespace NAME");
    run(["codespace", "view", "--codespace", codespace, "--json", "name,displayName,repository,state,machineName,devcontainerPath,idleTimeoutMinutes,retentionExpiresAt"], false);
    break;
  }
  default:
    fail("usage: forge-codespaces.js list [--repo OWNER/REPO] | create --repo OWNER/REPO [--branch BRANCH] [--machine TYPE] | view --codespace NAME | run --codespace NAME -- <command...> | stop --codespace NAME");
}

function valueOf(values, key) {
  const index = values.indexOf(key);
  if (index >= 0) return values[index + 1];
  const prefix = `${key}=`;
  return values.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}
