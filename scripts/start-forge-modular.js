#!/usr/bin/env node
"use strict";

const { spawn } = require("node:child_process");
const { createAccessToken, isLoopbackHost } = require("./forge-network-security");
const { OFFICE_IDS, buildOfficeAiEnvironment } = require("./forge-office-ai-env");

const hostArg = process.argv.find((arg) => arg.startsWith("--host="));
const host = hostArg ? hostArg.slice("--host=".length).trim() : (process.env.HOST || "127.0.0.1");
if (!host) throw new Error("Forge modular launcher host cannot be blank.");

const coreOnly = process.argv.includes("--core");
const officesArg = process.argv.find((arg) => arg.startsWith("--offices="));
const requestedAddons = coreOnly
  ? []
  : officesArg
    ? officesArg.slice("--offices=".length).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean)
    : String(process.env.FORGE_ENABLED_OFFICES || "journal,workbooks,specialized,nft").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);

const invalid = requestedAddons.filter((id) => id === "studio" || !OFFICE_IDS.includes(id));
if (invalid.length) throw new Error(`Unknown or invalid Forge add-on office(s): ${invalid.join(", ")}. Choose from journal, workbooks, specialized, nft.`);

const selected = ["studio", ...new Set(requestedAddons)];
const protectedLanMode = !isLoopbackHost(host);
const configuredToken = String(process.env.FORGE_ACCESS_TOKEN || "").trim();
if (protectedLanMode && configuredToken && configuredToken.length < 24) {
  throw new Error("FORGE_ACCESS_TOKEN must contain at least 24 characters when Forge is exposed beyond loopback.");
}
const sharedAccessToken = protectedLanMode ? (configuredToken || createAccessToken()) : "";
const children = [];
let shuttingDown = false;
let exitCode = 0;

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
}

function launchOffice(officeId) {
  const env = buildOfficeAiEnvironment(process.env, officeId);
  env.HOST = host;
  if (protectedLanMode) env.FORGE_ACCESS_TOKEN = sharedAccessToken;
  else delete env.FORGE_ACCESS_TOKEN;

  const args = ["scripts/start-forge.js", `--only=${officeId}`, `--host=${host}`];
  const child = spawn(process.execPath, args, { env, stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => {
    console.error(`[Forge Modular] ${officeId} failed to start: ${error.message}`);
    exitCode = 1;
    stopAll();
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      const detail = signal ? `signal ${signal}` : `code ${code}`;
      console.error(`[Forge Modular] ${officeId} exited unexpectedly (${detail}).`);
      exitCode = code && code !== 0 ? code : 1;
      stopAll();
    }
  });
}

for (const officeId of selected) launchOffice(officeId);

console.log(`[Forge Modular] Main Forge plus add-ons: ${selected.join(", ")}.`);
console.log("[Forge Modular] Every office runs in a separate process with its own AI scope, broker state, routing health/cooldowns and Forge-side quota accounting.");
console.log("[Forge Modular] Configure AI with FORGE_<OFFICE>_<PROVIDER_SETTING>; global provider credentials are not inherited unless FORGE_ALLOW_SHARED_AI_FALLBACK=true is explicitly set.");
if (protectedLanMode) {
  const displayHost = host === "0.0.0.0" || host === "::" ? "<device-ip>" : host;
  console.log(`[Forge Modular] Open Main Studio first: http://${displayHost}:4173/?access=${encodeURIComponent(sharedAccessToken)}`);
}

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));
process.on("uncaughtException", (error) => { console.error(error); exitCode = 1; stopAll(); });
process.on("unhandledRejection", (error) => { console.error(error); exitCode = 1; stopAll(); });

const interval = setInterval(() => {
  if (!shuttingDown) return;
  if (children.every((child) => child.exitCode !== null || child.signalCode !== null)) {
    clearInterval(interval);
    process.exit(exitCode);
  }
}, 50);
