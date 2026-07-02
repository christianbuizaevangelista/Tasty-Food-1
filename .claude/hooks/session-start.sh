#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Full-stack TypeScript monorepo:
#   * root      — serverless (Vercel) deps + Prisma
#   * backend/  — Express + Prisma API
#   * frontend/ — Vite + React
#
# Installs dependencies and generates the Prisma client so `tsc` type-checks
# and `vite build` work out of the box in a web session.
#
# Prisma downloads its native engine binaries in a postinstall step. Behind the
# web sandbox's egress proxy that download aborts (ECONNRESET), so we install
# with --ignore-scripts and fetch the engines ourselves with curl (which the
# proxy handles fine), placing them where Prisma expects. `prisma generate`
# then runs fully offline.
#
# Idempotent and non-interactive: safe to run on every session start.
set -euo pipefail

# Only run in the Claude Code on the web remote environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"

echo "[session-start] Installing dependencies (root, backend, frontend)..."
npm install            --no-audit --no-fund --ignore-scripts
npm --prefix backend  install --no-audit --no-fund --ignore-scripts
npm --prefix frontend install --no-audit --no-fund --ignore-scripts

echo "[session-start] Seeding Prisma engine binaries..."
VERSION="$(node -e "process.stdout.write(require('@prisma/engines-version').enginesVersion)")"
NATIVE="$(node -e "require('@prisma/get-platform').getBinaryTargetForCurrentPlatform().then(p=>process.stdout.write(p))")"
if [ -z "$VERSION" ] || [ -z "$NATIVE" ]; then
  echo "[session-start] ERROR: could not determine Prisma engine version/platform." >&2
  exit 1
fi
# Query engines are needed for every binaryTarget in backend/prisma/schema.prisma
# (native for local runs, rhel-* for the Vercel serverless build).
TARGETS="$NATIVE rhel-openssl-3.0.x rhel-openssl-1.0.x"
BASE="https://binaries.prisma.sh/all_commits/$VERSION"

fetch_gz() { # url dest
  curl -fsSL --retry 3 --retry-delay 2 "$1" | gunzip > "$2.tmp" && mv "$2.tmp" "$2"
}

seed_engines() { # dir
  local dir="$1" t qe se
  [ -d "$dir" ] || return 0
  for t in $TARGETS; do
    qe="$dir/libquery_engine-$t.so.node"
    [ -s "$qe" ] || { echo "  - $dir/libquery_engine-$t"; fetch_gz "$BASE/$t/libquery_engine.so.node.gz" "$qe"; }
  done
  se="$dir/schema-engine-$NATIVE"
  [ -s "$se" ] || { echo "  - $dir/schema-engine-$NATIVE"; fetch_gz "$BASE/$NATIVE/schema-engine.gz" "$se" && chmod +x "$se"; }
}

# Prisma resolves engines from the CLI package dir and from @prisma/engines,
# in both the root and backend installs.
for d in node_modules/prisma node_modules/@prisma/engines \
         backend/node_modules/prisma backend/node_modules/@prisma/engines; do
  seed_engines "$d"
done

echo "[session-start] Generating Prisma client..."
npm --prefix backend run prisma:generate

echo "[session-start] Done."
