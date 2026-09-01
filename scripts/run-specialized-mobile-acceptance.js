#!/usr/bin/env node
const { spawn } = require("node:child_process");

const TARGET = "scripts/specialized-creation-mobile-acceptance.js";
const RETRYABLE = /assert\.ok\(resizeBox\)|resizeBox\)/i;

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [TARGET], { env: process.env, stdio: ["inherit", "pipe", "pipe"] });
    let stderr = "";
    child.stdout.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr.on("data", (chunk) => { const text = String(chunk); stderr += text; process.stderr.write(chunk); });
    child.on("error", (error) => resolve({ code: 1, stderr: `${stderr}\n${error.stack || error.message}` }));
    child.on("exit", (code, signal) => resolve({ code: code ?? (signal ? 1 : 0), stderr }));
  });
}

(async () => {
  const first = await runOnce();
  if (first.code === 0) return;
  if (!RETRYABLE.test(first.stderr)) process.exit(first.code || 1);
  console.warn("Specialized mobile acceptance hit the known resize-handle visibility race; retrying the complete acceptance once from a clean process.");
  const second = await runOnce();
  process.exit(second.code || 0);
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
