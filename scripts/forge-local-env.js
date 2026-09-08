"use strict";

const { existsSync, statSync } = require("node:fs");
const { resolve } = require("node:path");
const { loadEnvFile } = require("node:process");

/**
 * Load Author's Forge runtime configuration from a local dotenv file.
 *
 * Node's built-in dotenv loader preserves environment variables that were
 * already exported by the parent shell. This lets an operator override a local
 * .env value without editing the file. Secret values are never returned or
 * logged by this helper.
 */
function loadForgeLocalEnv(options = {}) {
  const cwd = resolve(options.cwd || process.cwd());
  const configured = String(options.path || process.env.FORGE_ENV_FILE || "").trim();
  const filePath = resolve(cwd, configured || ".env");

  if (!existsSync(filePath)) {
    return Object.freeze({ loaded: false, filePath, variableCount: 0 });
  }
  if (!statSync(filePath).isFile()) {
    throw new Error(`Forge environment path is not a regular file: ${filePath}`);
  }

  const before = new Set(Object.keys(process.env));
  loadEnvFile(filePath);
  const variableCount = Object.keys(process.env).filter((key) => !before.has(key)).length;
  return Object.freeze({ loaded: true, filePath, variableCount });
}

module.exports = { loadForgeLocalEnv };
