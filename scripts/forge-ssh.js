#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");

function fail(message) {
  console.error(`Forge SSH: ${message}`);
  process.exit(1);
}

function valueOf(values, key) {
  const index = values.indexOf(key);
  if (index >= 0) return values[index + 1];
  const prefix = `${key}=`;
  return values.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function validHost(value) {
  return /^[A-Za-z0-9._:-]+$/.test(value);
}
function validUser(value) {
  return /^[A-Za-z0-9._-]+$/.test(value);
}

const args = process.argv.slice(2);
const host = valueOf(args, "--host");
const user = valueOf(args, "--user");
const port = valueOf(args, "--port") || "22";
const identity = valueOf(args, "--identity");
const sep = args.indexOf("--");

if (!host || !validHost(host)) fail("--host is required and must be a hostname or IP address");
if (user && !validUser(user)) fail("--user contains unsupported characters");
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) fail("--port must be between 1 and 65535");
if (sep === -1 || sep === args.length - 1) fail("provide a remote command after --");

const probe = spawnSync("ssh", ["-V"], { encoding: "utf8", timeout: 5000, windowsHide: true });
if (probe.error || probe.status !== 0) fail("OpenSSH client is required. Forge will not silently execute the command on the local host.");

const destination = `${user ? `${user}@` : ""}${host}`;
const command = args.slice(sep + 1).map(shellQuote).join(" ");
const sshArgs = [
  "-o", "BatchMode=yes",
  "-o", "ServerAliveInterval=15",
  "-o", "ServerAliveCountMax=3",
  "-p", port,
];
if (identity) sshArgs.push("-i", identity);
sshArgs.push(destination, command);

console.log(`Forge SSH target: ${destination}:${port}`);
const result = spawnSync("ssh", sshArgs, { stdio: "inherit", windowsHide: false });
if (result.error) fail(result.error.message);
process.exit(result.status ?? 1);

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}
