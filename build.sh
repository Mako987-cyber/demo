#!/bin/bash
# build.sh — Vercel build script
# Injects the NASA API key (stored as Vercel Environment Variable DEMO_KEY)
# into pages/neo/script.js at build time, replacing the __NASA_API_KEY__ placeholder.
#
# IMPORTANT: Never commit the real API key to this repo.
# The placeholder __NASA_API_KEY__ must remain in script.js in the repository.

set -e

echo "[build] Starting NEO Tracker build..."

if [ -z "$DEMO_KEY" ]; then
  echo "[build] WARNING: DEMO_KEY not set — falling back to NASA public DEMO_KEY (30 req/hour)."
else
  echo "[build] Injecting NASA API key into pages/neo/script.js..."
  # Use @ as delimiter to avoid conflicts with | or / characters
  sed -i "s@__NASA_API_KEY__@${DEMO_KEY}@g" pages/neo/script.js
  echo "[build] API key injected successfully."
fi

echo "[build] Build complete."
