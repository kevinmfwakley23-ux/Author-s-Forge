#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

# Author's Forge complete local Android launcher.
# All first-class Forge workplaces bind to all interfaces so the same phone
# can use localhost while another authorized device can connect over the LAN
# when the phone firewall/network permits it. Project data remains on-device.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-4173}"
export JOURNAL_PORT="${JOURNAL_PORT:-4273}"
export WORKBOOK_PORT="${WORKBOOK_PORT:-4373}"
export SPECIALIZED_PORT="${SPECIALIZED_PORT:-4473}"
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

echo "Author's Forge — complete workplace"
echo "===================================="
echo "Main Studio:          http://127.0.0.1:${PORT}"
echo "Guided Journal:       http://127.0.0.1:${JOURNAL_PORT}"
echo "Educational Workbook: http://127.0.0.1:${WORKBOOK_PORT}"
echo "Specialized Creation: http://127.0.0.1:${SPECIALIZED_PORT}"
echo "LAN bind:             ${HOST}"
echo "Data:                 ${FORGE_DATA_DIR}"
echo ""
echo "Keep this terminal running while using Forge."
echo "Open Chrome on this phone and visit http://127.0.0.1:${PORT}"
echo "The Studio dashboard carries the active project into the other offices."
echo ""

npm run forge:android
