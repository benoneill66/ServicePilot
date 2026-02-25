#!/bin/bash
set -euo pipefail

TARGET=$(rustc -vV | grep host | awk '{print $2}')
OUT="desktop/src-tauri/binaries/servicepilot-sidecar-${TARGET}"

echo "Building sidecar for ${TARGET}..."
mkdir -p desktop/src-tauri/binaries
bun build sidecar/main.ts --compile --outfile "${OUT}"
echo "Built: ${OUT}"
