#!/usr/bin/env bash
# Single entry point for this repo's check — the SAME steps GitHub Actions runs, so the local
# pre-push hook and CI can never disagree. Exits non-zero on the first failure.
# (Mirrors .github/workflows/ci.yml: install · check · test · build.)
#
# ⚠️ `astro check` / `astro build` HANG at 0% CPU in the agent sandbox (any Node).
#    Run this on a real terminal (Node 22). The pure unit tests (vitest) run anywhere.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules ] && { [ -f package-lock.json ] || [ -f package.json ]; }; then
  echo "→ install deps"
  if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi
fi

echo "→ check"; npm run check
echo "→ test";  npm test
echo "→ build"; npm run build
echo "✅ ALL GREEN"
