#!/usr/bin/env bash

set -Eeuo pipefail

readonly image="${1:?Usage: project-image-smoke.sh <image> <packages-csv> <version> <project-sha>}"
readonly expected_packages_csv="${2:?Usage: project-image-smoke.sh <image> <packages-csv> <version> <project-sha>}"
readonly expected_version="${3:?Usage: project-image-smoke.sh <image> <packages-csv> <version> <project-sha>}"
readonly project_sha="${4:?Usage: project-image-smoke.sh <image> <packages-csv> <version> <project-sha>}"

[[ "$expected_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  echo "Invalid exact stable smoke version: $expected_version" >&2
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
readonly run_id="${GITHUB_RUN_ID:-$$}"
[[ "$run_id" =~ ^[0-9]+$ ]] || {
  echo "Invalid smoke run id: $run_id" >&2
  exit 1
}
readonly prefix="tradejs-project-smoke-${run_id}"
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

initial_verification="$(runtime_cli runtime-control verify \
  --user root --deployment production)"
grep -Eq '"deploymentCompositionId": "dc1:[a-f0-9]{16}"' <<<"$initial_verification"
grep -Eq '"strategyRevision": "sr1:[a-f0-9]{16}"' <<<"$initial_verification"
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
  -e AUTH_SECRET=project-smoke-auth-secret \
  -e NEXTAUTH_SECRET=project-smoke-auth-secret \
  -e NEXTAUTH_URL=http://127.0.0.1:3000 \
  -e APP_URL=http://127.0.0.1:3000 \
  "$image" /app/node_modules/.bin/tradejs-app start >/dev/null

wait_for_command 'app health' docker exec "$app_container" \
  curl -fsS http://127.0.0.1:3000

docker exec \
  -e EXPECTED_PACKAGE_VERSION="$expected_version" \
  -e EXPECTED_PACKAGES_CSV="$expected_packages_csv" \
  -e EXPECTED_PROJECT_SHA="$project_sha" \
  "$app_container" node --input-type=module -e '
    import fs from "node:fs";
    const manifest = JSON.parse(fs.readFileSync("/app/runtime-package-manifest.json", "utf8"));
    const expectedPackages = process.env.EXPECTED_PACKAGES_CSV.split(",");
    if (manifest.schema !== "tradejs-runtime-package-manifest/v1") {
      throw new Error(`Runtime manifest schema mismatch: ${manifest.schema}`);
    }
    if (manifest.projectSha !== process.env.EXPECTED_PROJECT_SHA) {
      throw new Error(`Project SHA mismatch: ${manifest.projectSha}`);
    }
    for (const name of expectedPackages) {
      if (manifest.packages[name] !== process.env.EXPECTED_PACKAGE_VERSION) {
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

printf 'Stable Project image smoke passed: %s (%s)\n' \
  "$expected_version" "$project_sha"
