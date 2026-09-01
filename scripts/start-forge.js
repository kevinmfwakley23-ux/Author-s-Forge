#!/usr/bin/env node
const { spawn } = require("node:child_process");

const hostArg = process.argv.find((arg) => arg.startsWith("--host="));
const host = hostArg ? hostArg.slice("--host=".length).trim() : (process.env.HOST || "127.0.0.1");
if (!host) throw new Error("Forge launcher host cannot be blank.");

const services = [
  { name: "Studio", entry: "dist/studio-server.js", portKey: "PORT", port: process.env.PORT || "4173" },
  { name: "Guided Journal", entry: "dist/guided-journal-server.js", portKey: "JOURNAL_PORT", port: process.env.JOURNAL_PORT || "4273" },
  { name: "Educational Workbooks", entry: "dist/educational-workbook-server.js", portKey: "WORKBOOK_PORT", port: process.env.WORKBOOK_PORT || "4373" },
  { name: "Specialized Creation", entry: "dist/specialized-creation-server.js", portKey: "SPECIALIZED_PORT", port: process.env.SPECIALIZED_PORT || "4473" },
];

const seen = new Set();
for (const service of services) {
  const port = Number(service.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${service.name} port must be an integer from 1 to 65535.`);
  if (seen.has(port)) throw new Error(`Forge launcher port collision detected at ${port}. Configure distinct service ports.`);
  seen.add(port);
}

const children = [];
let shuttingDown = false;
let exitCode = 0;

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed && child.exitCode === null) child.kill(signal);
  }
}

function launch(service) {
  const env = { ...process.env, HOST: host, [service.portKey]: service.port };
  const child = spawn(process.execPath, [service.entry], { env, stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => {
    console.error(`[Forge] ${service.name} failed to start: ${error.message}`);
    exitCode = 1;
    stopAll();
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      const detail = signal ? `signal ${signal}` : `code ${code}`;
      console.error(`[Forge] ${service.name} exited unexpectedly (${detail}).`);
      exitCode = code && code !== 0 ? code : 1;
      stopAll();
    }
  });
  console.log(`[Forge] ${service.name}: http://${host === "0.0.0.0" ? "<device-ip>" : host}:${service.port}`);
}

process.on("SIGINT", () => stopAll("SIGINT"));
process.on("SIGTERM", () => stopAll("SIGTERM"));
process.on("uncaughtException", (error) => {
  console.error(error);
  exitCode = 1;
  stopAll();
});
process.on("unhandledRejection", (error) => {
  console.error(error);
  exitCode = 1;
  stopAll();
});

for (const service of services) launch(service);

const interval = setInterval(() => {
  if (!shuttingDown) return;
  if (children.every((child) => child.exitCode !== null || child.killed)) {
    clearInterval(interval);
    process.exit(exitCode);
  }
}, 50);
