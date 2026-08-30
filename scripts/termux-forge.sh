#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

# Author's Forge local Android launcher.
# The server binds to all interfaces so the same phone can open Forge at
# http://127.0.0.1:4173 while the Chromebook can reach it over the LAN when
# the phone firewall/network permits it. Project data remains on the device.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-4173}"
export FORGE_DATA_DIR="${FORGE_DATA_DIR:-$ROOT/.forge-data}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install it with: pkg install nodejs"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required and should be installed with Node.js."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing Forge dependencies..."
  npm ci
fi

mkdir -p "$FORGE_DATA_DIR"

echo "Author's Forge"
echo "=============="
echo "Local URL:   http://127.0.0.1:${PORT}"
echo "LAN bind:    ${HOST}:${PORT}"
echo "Data:        ${FORGE_DATA_DIR}"
echo ""
echo "Keep this terminal running while using Forge."
echo "Open Chrome on this phone and visit http://127.0.0.1:${PORT}"
echo ""

npm run studio
