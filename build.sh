#!/bin/bash
# build.sh — Vercel build script
# Injects the NASA API key (stored as Vercel Environment Variable DEMO_KEY)
# into pages/neo/script.js at build time, replacing the __NASA_API_KEY__ placeholder.
#
# How it works:
#   1. Vercel runs this script before deploying (configured in vercel.json)
#   2. The DEMO_KEY env var is read from Vercel Project Settings > Environment Variables
#   3. sed replaces the placeholder string in the JS file with the real key
#   4. The modified file is served statically — the key is never exposed in the repo
#
# IMPORTANT: Never commit the real API key to this repo.
# The placeholder __NASA_API_KEY__ must remain in script.js in the repository.

set -e

echo "[build] Starting NEO Tracker build..."

# Check that the env variable is available
if [ -z "$DEMO_KEY" ]; then
  echo "[build] WARNING: DEMO_KEY environment variable not set."
  echo "[build] The app will fall back to NASA's public DEMO_KEY (rate-limited to 30 req/hour)."
else
  echo "[build] Injecting NASA API key into pages/neo/script.js..."
  # Use | as sed delimiter to avoid issues with / characters in the key
  sed -i "s|window.__NASA_API_KEY__ || 'DEMO_KEY'|'${DEMO_KEY}'|g" pages/neo/script.js
  echo "[build] API key injected successfully."
fi

echo "[build] Build complete."
