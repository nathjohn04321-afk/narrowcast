#!/usr/bin/env bash
# Runs the browser checks for index.html. Needs Node; Playwright is installed here
# on first run, into a folder git ignores.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"

if [ ! -d node_modules/playwright ]; then
  echo "installing playwright into tools/app-check ..."
  npm init -y >/dev/null 2>&1 || true
  npm install playwright --no-save --silent
fi

# Reuse a browser the machine already has, when there is one.
if [ -z "${PLAYWRIGHT_CHROMIUM:-}" ]; then
  found="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1 || true)"
  [ -n "$found" ] && export PLAYWRIGHT_CHROMIUM="$found"
fi
[ -z "${PLAYWRIGHT_CHROMIUM:-}" ] && npx playwright install chromium

node app-check.js
