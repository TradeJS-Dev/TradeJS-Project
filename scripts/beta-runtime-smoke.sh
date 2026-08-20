#!/usr/bin/env bash

set -Eeuo pipefail

readonly image="${1:?Usage: beta-runtime-smoke.sh <image> <packages-csv> <version> <project-sha>}"
readonly expected_packages_csv="${2:?Usage: beta-runtime-smoke.sh <image> <packages-csv> <version> <project-sha>}"
readonly beta_version="${3:?Usage: beta-runtime-smoke.sh <image> <packages-csv> <version> <project-sha>}"
readonly project_sha="${4:?Usage: beta-runtime-smoke.sh <image> <packages-csv> <version> <project-sha>}"
readonly expected_runtime_version="${5:-$(node --input-type=module -e '
  import fs from "node:fs";
  const source = fs.readFileSync("config/runtime/strategies/double-tap.ts", "utf8");
  const match = /version: ([1-9][0-9]*),/.exec(source);
  if (!match) process.exit(1);
  process.stdout.write(match[1]);
')}"

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
[[ "$expected_runtime_version" =~ ^[1-9][0-9]*$ ]] || {
  echo "Invalid expected DoubleTap runtime version: $expected_runtime_version" >&2
  exit 1
}

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
  users:root:trading-accounts:bybit-default '$' \
  '{"id":"bybit-default","label":"Beta smoke","provider":"bybit","enabled":true,"isDefault":true,"universes":["crypto"],"environment":"testnet","readOnly":true}' \
  >/dev/null

initial_verification="$(runtime_cli runtime-control verify \
  --user root --deployment production)"
grep -q "\"version\": $expected_runtime_version" <<<"$initial_verification"
grep -q '"controlState": "active"' <<<"$initial_verification"
[[ "$(docker exec "$redis_container" redis-cli EXISTS users:root:runtime:controls)" == "0" ]]

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
  -e SIGNALS_DAEMON_DEPLOYMENT_ID=production \
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

runtime_cli runtime-control pause \
  --user root --deployment production --strategy DoubleTap >/dev/null
paused="$(runtime_cli runtime-control inspect \
  --user root --deployment production --strategy DoubleTap)"
grep -q '"controlState": "entries_paused"' <<<"$paused"
[[ "$(docker exec "$redis_container" redis-cli EXISTS users:root:runtime:controls)" == "1" ]]

runtime_cli runtime-control resume \
  --user root --deployment production --strategy DoubleTap >/dev/null
resumed="$(runtime_cli runtime-control inspect \
  --user root --deployment production --strategy DoubleTap)"
grep -q '"controlState": "active"' <<<"$resumed"
[[ "$(docker exec "$redis_container" redis-cli EXISTS users:root:runtime:controls)" == "0" ]]

legacy_keys="$(docker exec "$redis_container" redis-cli --scan | \
  grep -E 'users:root:strategies:.*:(config|release-seq|releases:)|users:root:runtime:deployments:(doubletap-forward|doubletap-smoke)$' || true)"
if [[ -n "$legacy_keys" ]]; then
  echo "Legacy runtime configuration keys were created:" >&2
  echo "$legacy_keys" >&2
  exit 1
fi

docker exec "$app_container" curl -fsS http://127.0.0.1:3000 >/dev/null
if docker logs "$app_container" 2>&1 | grep -qi 'cycle failed'; then
  docker logs "$app_container" >&2
  exit 1
fi

printf 'Production-like beta smoke passed: %s (%s)\n' \
  "$beta_version" "$project_sha"
