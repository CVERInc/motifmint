#!/usr/bin/env bash
# Single entry point for this repo's check — the SAME steps GitHub Actions runs, so the local
# pre-push hook and CI can never disagree. Exits non-zero on the first failure.
# (Mirrors .github/workflows/ci.yml: install · check · test · build.)
#
# Needs Node 22 (see .nvmrc). If `astro check` / `astro build` stall in a restricted
# sandbox, re-run this in a regular terminal instead of skipping those steps.
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
