#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");

const MAX_ATTEMPTS = 4;
const startupTimeoutPattern = /Timed out waiting for http:\/\/127\.0\.0\.1:\d+\/api\/health/;

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/studio-mobile-acceptance.js"], {
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stderr = "";
    child.stdout.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", (error) => resolve({ code: 1, stderr: `${stderr}\n${error.stack || error}` }));
    child.on("close", (code, signal) => resolve({ code: code ?? 1, signal, stderr }));
  });
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await runOnce();
    if (result.code === 0) return;

    const retryableStartupFailure = startupTimeoutPattern.test(result.stderr);
    if (!retryableStartupFailure || attempt === MAX_ATTEMPTS) {
      process.exitCode = result.code || 1;
      return;
    }

    process.stderr.write(`[Forge mobile acceptance] Studio did not claim its randomized loopback port on attempt ${attempt}; retrying the unchanged mobile acceptance on a fresh port.\n`);
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
