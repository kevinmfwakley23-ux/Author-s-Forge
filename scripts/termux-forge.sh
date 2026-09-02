#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

# Author's Forge complete local Android launcher.
# The public office ports may bind to the LAN, but the real office processes
# remain loopback-only behind the launcher's protected access proxy.
# Project data remains on-device and anonymous LAN requests are rejected.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-4173}"
export JOURNAL_PORT="${JOURNAL_PORT:-4273}"
export WORKBOOK_PORT="${WORKBOOK_PORT:-4373}"
export SPECIALIZED_PORT="${SPECIALIZED_PORT:-4473}"
export FORGE_DATA_DIR="${FORGE_DATA_DIR:-$ROOT/.forge-data}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 24 LTS is required. Install the Termux LTS runtime with: pkg install nodejs-lts npm"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" != "24" ]; then
  echo "Author's Forge requires the validated Node.js 24 LTS runtime; found Node $(node -p 'process.versions.node')."
  echo "Termux users should use nodejs-lts, not the current-release nodejs package."
  echo "If nodejs is installed, switch deliberately with: pkg uninstall nodejs && pkg install nodejs-lts npm"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install it with: pkg install npm"
  exit 1
fi

node scripts/require-node24.js

if [ -z "${FORGE_ACCESS_TOKEN:-}" ]; then
  FORGE_ACCESS_TOKEN="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')"
  export FORGE_ACCESS_TOKEN
fi

if [ "${#FORGE_ACCESS_TOKEN}" -lt 24 ]; then
  echo "FORGE_ACCESS_TOKEN must contain at least 24 characters."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing Forge dependencies from package-lock.json..."
  npm ci
fi

mkdir -p "$FORGE_DATA_DIR"

echo "Author's Forge — complete workplace"
echo "===================================="
echo "Runtime:              Node $(node -p 'process.versions.node')"
echo "Main Studio:          http://127.0.0.1:${PORT}"
echo "Guided Journal:       http://127.0.0.1:${JOURNAL_PORT}"
echo "Educational Workbook: http://127.0.0.1:${WORKBOOK_PORT}"
echo "Specialized Creation: http://127.0.0.1:${SPECIALIZED_PORT}"
echo "Protected LAN bind:   ${HOST}"
echo "Data:                 ${FORGE_DATA_DIR}"
echo ""
echo "Keep this terminal running while using Forge."
echo "Open Chrome on this phone with the protected bootstrap URL:"
echo "http://127.0.0.1:${PORT}/?access=${FORGE_ACCESS_TOKEN}"
echo "After the first redirect, Forge stores an HttpOnly access cookie for this host."
echo "The same cookie carries the active session across the other Forge office ports."
echo "For another trusted LAN device, replace 127.0.0.1 with this phone's LAN IP."
echo ""

npm run forge:android
