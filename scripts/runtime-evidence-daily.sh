#!/usr/bin/env bash
set -Eeuo pipefail
cd /app
readonly log_dir=data/runtime-evidence/logs
mkdir -p "$log_dir"
readonly log_path="$log_dir/$(date -u +%Y%m%dT%H%M%SZ)-$$.log"
exec >>"$log_path" 2>&1

record_exit() {
  local exit_code=$1
  printf '%s event=finished exitCode=%s\n' "$(date -u +%FT%TZ)" "$exit_code"
}
trap 'record_exit "$?"' EXIT
printf '%s event=started\n' "$(date -u +%FT%TZ)"

readonly identity_path="/run/tradejs/runtime-cron-identity.env"
if [[ ! -r "$identity_path" ]]; then
  printf 'Runtime cron identity is not readable: %s\n' "$identity_path" >&2
  exit 1
fi
. "$identity_path"
IFS=',' read -r -a deployments <<<"${RUNTIME_EVIDENCE_DEPLOYMENT_ID:-production}"
status=0
for deployment in "${deployments[@]}"; do
  if [[ ! "$deployment" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    printf 'Invalid runtime evidence deployment: %s\n' "$deployment" >&2
    status=1
    continue
  fi
  printf '%s event=deployment-started deployment=%s\n' "$(date -u +%FT%TZ)" "$deployment"
  if PROJECT_CWD=/app DOTENV_CONFIG_PATH=/app/.env NODE_OPTIONS="--max-old-space-size=${RUNTIME_EVIDENCE_HEAP_MB:-1024}" \
    ./node_modules/.bin/tradejs runtime-evidence --daily --user root \
    --publishDir /app/data/runtime-evidence --deployment "$deployment" \
    --out "/app/data/runtime-evidence/latest/$deployment/runtime-evidence.json"; then
    deployment_exit_code=0
  else
    deployment_exit_code=$?
    status=1
  fi
  printf '%s event=deployment-finished deployment=%s exitCode=%s\n' \
    "$(date -u +%FT%TZ)" "$deployment" "$deployment_exit_code"
done
exit "$status"
