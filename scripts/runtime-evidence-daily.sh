#!/usr/bin/env bash
set -Eeuo pipefail
. /run/tradejs/runtime-cron-identity.env
cd /app
IFS=',' read -r -a deployments <<<"${RUNTIME_EVIDENCE_DEPLOYMENT_ID:-production}"
status=0
for deployment in "${deployments[@]}"; do
  if [[ ! "$deployment" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    printf 'Invalid runtime evidence deployment: %s\n' "$deployment" >&2
    status=1
    continue
  fi
  PROJECT_CWD=/app DOTENV_CONFIG_PATH=/app/.env NODE_OPTIONS="--max-old-space-size=${RUNTIME_EVIDENCE_HEAP_MB:-1024}" \
    ./node_modules/.bin/tradejs runtime-evidence --daily --user root \
    --publishDir /app/data/runtime-evidence --deployment "$deployment" \
    --out "/app/data/runtime-evidence/latest/$deployment/runtime-evidence.json" || status=1
done
exit "$status"
