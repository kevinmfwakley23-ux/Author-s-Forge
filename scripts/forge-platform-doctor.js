#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const argv = new Set(process.argv.slice(2));
const jsonMode = argv.has("--json");

function commandVersion(command, args = ["--version"], options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 5000,
    shell: false,
    windowsHide: true,
    ...options,
  });
  if (result.error || result.status !== 0) return { available: false };
  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim().split(/\r?\n/)[0]?.trim();
  return { available: true, version: output || "available" };
}

function exists(value) {
  try { return Boolean(value) && fs.existsSync(value); }
  catch { return false; }
}

function detectChromeOs() {
  if (process.env.CROS_USER_ID_HASH || process.env.CHROMEOS_RELEASE_NAME) return true;
  try {
    const release = fs.readFileSync("/etc/os-release", "utf8");
    if (/chrome\s*os|chromium\s*os/i.test(release)) return true;
  } catch {}
  try {
    const version = fs.readFileSync("/proc/version", "utf8");
    if (/chrome\s*os|chromium\s*os/i.test(version)) return true;
  } catch {}
  return exists("/mnt/chromeos");
}

function detectWsl() {
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  try { return /microsoft/i.test(fs.readFileSync("/proc/version", "utf8")); }
  catch { return false; }
}

function detectContainer() {
  if (exists("/.dockerenv") || exists("/run/.containerenv")) return true;
  try { return /(docker|containerd|kubepods|lxc)/i.test(fs.readFileSync("/proc/1/cgroup", "utf8")); }
  catch { return false; }
}

function detectTermux() {
  return Boolean(process.env.TERMUX_VERSION || process.env.PREFIX?.includes("com.termux") || process.env.TERMUX__PACKAGE_MANAGER);
}

function detectCi() {
  return Boolean(process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI || process.env.BUILDKITE || process.env.CIRCLECI);
}

function detectCodespaces() {
  return Boolean(process.env.CODESPACES || process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN);
}

function detectAndroidSdk() {
  const root = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  return { available: exists(root), root: exists(root) ? root : undefined };
}

function detectXcode() {
  if (process.platform !== "darwin") return { available: false };
  const result = spawnSync("xcodebuild", ["-version"], { encoding: "utf8", timeout: 5000, shell: false });
  if (result.error || result.status !== 0) return { available: false };
  return { available: true, version: String(result.stdout || "").trim().replace(/\r?\n/g, " / ") };
}

const tools = {
  node: commandVersion(process.execPath, ["--version"]),
  npm: commandVersion(process.platform === "win32" ? "npm.cmd" : "npm"),
  git: commandVersion("git"),
  githubCli: commandVersion("gh"),
  docker: commandVersion("docker"),
  podman: commandVersion("podman"),
  rustc: commandVersion("rustc"),
  cargo: commandVersion("cargo"),
  java: commandVersion("java", ["-version"]),
  adb: commandVersion("adb"),
  xcode: detectXcode(),
  androidSdk: detectAndroidSdk(),
};

const host = {
  platform: process.platform,
  arch: process.arch,
  release: os.release(),
  hostname: os.hostname(),
  home: os.homedir(),
  cwd: process.cwd(),
  chromeOs: detectChromeOs(),
  wsl: detectWsl(),
  container: detectContainer(),
  termux: detectTermux(),
  codespaces: detectCodespaces(),
  ci: detectCi(),
};

const capabilities = {
  forgeRuntime: tools.node.available && tools.npm.available,
  gitWorkflows: tools.git.available,
  githubWorkflows: tools.git.available && tools.githubCli.available,
  localSandbox: tools.docker.available || tools.podman.available,
  linuxShell: process.platform === "linux" || host.wsl || host.termux,
  termuxBridge: host.termux && tools.git.available && tools.node.available,
  codespaces: host.codespaces,
  nativeDesktopBuild: tools.rustc.available && tools.cargo.available && ["linux", "darwin", "win32"].includes(process.platform),
  androidBuild: tools.rustc.available && tools.cargo.available && tools.java.available && tools.androidSdk.available,
  iosBuild: process.platform === "darwin" && tools.rustc.available && tools.cargo.available && tools.xcode.available,
};

const recommendations = [];
if (!capabilities.forgeRuntime) recommendations.push("Install the repository-supported Node 24 LTS runtime and npm before running the local Forge server.");
if (!tools.git.available) recommendations.push("Install Git to enable repository import, branching, patching, and local version-control workflows.");
if (!tools.githubCli.available) recommendations.push("Install GitHub CLI only if you want authenticated GitHub/Codespaces control from this host; Forge must continue working without it.");
if (!capabilities.localSandbox) recommendations.push("Install Docker or Podman if you want Forge to execute untrusted build/test commands inside a local disposable sandbox.");
if (!tools.rustc.available || !tools.cargo.available) recommendations.push("Install Rust only on machines that will build native Tauri installers; end users do not need Rust to run packaged apps.");
if (process.platform === "darwin" && !tools.xcode.available) recommendations.push("Install Xcode before attempting iPhone/iPad or App Store builds.");
if (!tools.androidSdk.available) recommendations.push("Install/configure the Android SDK only on machines that will build Android APK/AAB packages.");

const report = {
  generatedAt: new Date().toISOString(),
  host,
  tools,
  capabilities,
  recommendations,
  truth: "Capabilities are detected from the current machine. Missing tools are reported as unavailable; Forge does not simulate them.",
};

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log("Author's Forge platform doctor");
  console.log(`Host: ${host.platform}/${host.arch}${host.chromeOs ? " ChromeOS" : ""}${host.termux ? " Termux" : ""}${host.codespaces ? " Codespaces" : ""}${host.wsl ? " WSL" : ""}`);
  console.log("");
  for (const [name, value] of Object.entries(capabilities)) console.log(`${value ? "[YES]" : "[NO ]"} ${name}`);
  if (recommendations.length) {
    console.log("\nRecommendations:");
    for (const recommendation of recommendations) console.log(`- ${recommendation}`);
  }
  console.log("\nUse --json for machine-readable output.");
}
