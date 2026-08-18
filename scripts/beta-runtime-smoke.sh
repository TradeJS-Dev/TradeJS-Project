#!/usr/bin/env bash

set -Eeuo pipefail

readonly image="${1:?Usage: beta-runtime-smoke.sh <image> <packages-csv> <version> <project-sha>}"
readonly expected_packages_csv="${2:?Usage: beta-runtime-smoke.sh <image> <packages-csv> <version> <project-sha>}"
readonly beta_version="${3:?Usage: beta-runtime-smoke.sh <image> <packages-csv> <version> <project-sha>}"
readonly project_sha="${4:?Usage: beta-runtime-smoke.sh <image> <packages-csv> <version> <project-sha>}"

[[ "$beta_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-beta\.[1-9][0-9]*)?$ ]] || {
  echo "Invalid exact smoke version: $beta_version" >&2
  exit 1
}
[[ "$project_sha" =~ ^[0-9a-f]{40}$ ]] || {
  echo "Invalid Project SHA: $project_sha" >&2
  exit 1
}
[[ "$expected_packages_csv" =~ ^@tradejs/[a-z0-9-]+(,@tradejs/[a-z0-9-]+)*$ ]] || {
  echo "Invalid expected package list: $expected_packages_csv" >&2
  exit 1
}

readonly script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly run_id="${GITHUB_RUN_ID:-$$}"
[[ "$run_id" =~ ^[0-9]+$ ]] || {
  echo "Invalid smoke run id: $run_id" >&2
  exit 1
}
readonly prefix="tradejs-beta-${run_id}"
readonly network="${prefix}-network"
readonly redis_container="${prefix}-redis"
readonly timescale_container="${prefix}-timescale"
readonly app_container="${prefix}-app"
readonly fixture_v1="${script_dir}/fixtures/doubletap-smoke-v1.json"
readonly fixture_v2="${script_dir}/fixtures/doubletap-smoke-v2.json"

cleanup() {
  docker rm -f \
    "$app_container" "$timescale_container" "$redis_container" \
    >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_command() {
  local label="$1"
  shift
  for attempt in $(seq 1 60); do
    if "$@" >/dev/null 2>&1; then
      return 0
    fi
    if [[ "$attempt" -eq 60 ]]; then
      echo "Timed out waiting for $label" >&2
      return 1
    fi
    sleep 2
  done
}

runtime_cli() {
  docker run --rm \
    --network "$network" \
    -e PROJECT_CWD=/app \
    -e USER_NAME=root \
    -e REDIS_HOST=redis \
    -e REDIS_PORT=6379 \
    -e PG_HOST=timescale \
    -e PG_PORT=5432 \
    -e PG_USER=app \
    -e PG_PASSWORD=app \
    -e PG_DATABASE=app \
    -v "${script_dir}/fixtures:/smoke:ro" \
    --entrypoint /app/node_modules/.bin/tradejs \
    "$image" "$@"
}

docker network create "$network" >/dev/null
docker run -d \
  --name "$redis_container" \
  --network "$network" \
  --network-alias redis \
  redis/redis-stack:7.4.0-v8 >/dev/null
docker run -d \
  --name "$timescale_container" \
  --network "$network" \
  --network-alias timescale \
  -e POSTGRES_USER=app \
  -e POSTGRES_PASSWORD=app \
  -e POSTGRES_DB=app \
  timescale/timescaledb:latest-pg16 >/dev/null

wait_for_command Redis docker exec "$redis_container" redis-cli ping
wait_for_command Timescale docker exec "$timescale_container" \
  pg_isready -U app -d app

docker exec "$redis_container" redis-cli JSON.SET \
  users:root:trading-accounts:bybit-staging '$' \
  '{"id":"bybit-staging","label":"Beta smoke","provider":"bybit","enabled":true,"isDefault":true,"universes":["crypto"],"environment":"testnet","readOnly":true}' \
  >/dev/null

runtime_cli runtime-config provision \
  --user root \
  --strategy DoubleTap \
  --deployment doubletap-smoke \
  --account bybit-staging \
  --connector bybit \
  --provider bybit \
  --file /smoke/$(basename "$fixture_v1") \
  --write >/dev/null
docker exec "$redis_container" redis-cli JSON.SET \
  users:root:runtime:deployments:doubletap-smoke '$.tickers' \
  '["BTCUSDT"]' >/dev/null

initial_verification="$(runtime_cli runtime-config verify \
  --user root --deployment doubletap-smoke)"
grep -q '"releaseVersion": 1' <<<"$initial_verification"
grep -q '"controlState": "entries_paused"' <<<"$initial_verification"

docker run -d \
  --name "$app_container" \
  --network "$network" \
  -e USER_NAME=root \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  -e PG_HOST=timescale \
  -e PG_PORT=5432 \
  -e PG_USER=app \
  -e PG_PASSWORD=app \
  -e PG_DATABASE=app \
  -e AUTH_SECRET=beta-smoke-auth-secret \
  -e NEXTAUTH_SECRET=beta-smoke-auth-secret \
  -e NEXTAUTH_URL=http://127.0.0.1:3000 \
  -e APP_URL=http://127.0.0.1:3000 \
  -e SIGNALS_DAEMON_DEPLOYMENT_ID=doubletap-smoke \
  -e SIGNALS_DAEMON_TIMEFRAME=1 \
  -e SIGNALS_DAEMON_NOTIFY=false \
  -e SIGNALS_DAEMON_MAKE_ORDERS=false \
  -e SIGNALS_DAEMON_SHOW_SKIP_STATS=false \
  -e SIGNALS_DAEMON_EXTRA_ARGS='--cacheOnly --settleDelayMs 60000' \
  -e SIGNALS_KLINE_WS_ENABLED=false \
  -e DERIVATIVES_CONTEXT_ENABLED=false \
  -e MARKET_WS_PORT=3001 \
  "$image" >/dev/null

wait_for_command 'app health' docker exec "$app_container" \
  curl -fsS http://127.0.0.1:3000
wait_for_command 'market websocket health' docker exec "$app_container" \
  curl -fsS http://127.0.0.1:3001/health

docker exec \
  -e EXPECTED_BETA_VERSION="$beta_version" \
  -e EXPECTED_PACKAGES_CSV="$expected_packages_csv" \
  -e EXPECTED_PROJECT_SHA="$project_sha" \
  "$app_container" node --input-type=module -e '
    import fs from "node:fs";
    const manifest = JSON.parse(fs.readFileSync("/app/runtime-package-manifest.json", "utf8"));
    const expectedPackages = process.env.EXPECTED_PACKAGES_CSV.split(",");
    if (manifest.projectSha !== process.env.EXPECTED_PROJECT_SHA) {
      throw new Error(`Project SHA mismatch: ${manifest.projectSha}`);
    }
    for (const name of expectedPackages) {
      if (manifest.packages[name] !== process.env.EXPECTED_BETA_VERSION) {
        throw new Error(`${name} is ${manifest.packages[name]}`);
      }
    }
  '

runtime_cli runtime-config rollout \
  --user root \
  --strategy DoubleTap \
  --deployment doubletap-smoke \
  --file /smoke/$(basename "$fixture_v2") \
  --write >/dev/null
rollout_verification="$(runtime_cli runtime-config verify \
  --user root --deployment doubletap-smoke)"
grep -q '"releaseVersion": 2' <<<"$rollout_verification"
grep -q '"controlState": "entries_paused"' <<<"$rollout_verification"

deployment_json="$(docker exec "$redis_container" redis-cli --raw JSON.GET \
  users:root:runtime:deployments:doubletap-smoke)"
release_v1_json="$(docker exec "$redis_container" redis-cli --raw JSON.GET \
  users:root:strategies:DoubleTap:releases:1)"
release_v2_json="$(docker exec "$redis_container" redis-cli --raw JSON.GET \
  users:root:strategies:DoubleTap:releases:2)"
mutable_config_exists="$(docker exec "$redis_container" redis-cli --raw EXISTS \
  users:root:strategies:DoubleTap:config)"
DEPLOYMENT_JSON="$deployment_json" \
RELEASE_V1_JSON="$release_v1_json" \
RELEASE_V2_JSON="$release_v2_json" \
MUTABLE_CONFIG_EXISTS="$mutable_config_exists" \
node --input-type=module -e '
  const deployment = JSON.parse(process.env.DEPLOYMENT_JSON);
  const releaseV1 = JSON.parse(process.env.RELEASE_V1_JSON);
  const releaseV2 = JSON.parse(process.env.RELEASE_V2_JSON);
  const reference = deployment.strategies[0];
  const referenceKeys = Object.keys(reference).sort().join(",");
  if (referenceKeys !== "controlState,releaseVersion,strategyName") {
    throw new Error(`Invalid deployment strategy fields: ${referenceKeys}`);
  }
  if (reference.releaseVersion !== 2 || reference.controlState !== "entries_paused") {
    throw new Error("Deployment did not switch to paused release v2");
  }
  if (releaseV1.config.MAX_LOSS_VALUE !== 1 || releaseV2.config.MAX_LOSS_VALUE !== 2) {
    throw new Error("Immutable release configs were not preserved");
  }
  if (process.env.MUTABLE_CONFIG_EXISTS !== "0") {
    throw new Error("Legacy mutable strategy config exists");
  }
'

docker exec "$app_container" curl -fsS http://127.0.0.1:3000 >/dev/null
if docker logs "$app_container" 2>&1 | grep -qi 'cycle failed'; then
  docker logs "$app_container" >&2
  exit 1
fi

printf 'Production-like beta smoke passed: %s (%s)\n' \
  "$beta_version" "$project_sha"
