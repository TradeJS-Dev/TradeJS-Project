#!/usr/bin/env bash

set -Eeuo pipefail

readonly SIGNALS_LOG_PATH="${SIGNALS_LOG_PATH:-/var/log/cron.signals.15.log}"
readonly SIGNALS_DAEMON_DEPLOYMENT_ID="${SIGNALS_DAEMON_DEPLOYMENT_ID:?SIGNALS_DAEMON_DEPLOYMENT_ID is required}"
declare -a managed_pids=()
declare -a signals_pids=()

append_bool_flag() {
  local flag="$1"
  local value="$2"

  case "${value,,}" in
    1 | true | yes | on)
      signals_args+=("$flag")
      ;;
    0 | false | no | off | '')
      ;;
    *)
      printf 'Invalid boolean value for %s: %s\n' "$flag" "$value" >&2
      exit 1
      ;;
  esac
}

parse_deployment_ids() {
  local raw="$1"
  local -a values=()
  local item

  IFS=',' read -r -a values <<<"$raw"
  for item in "${values[@]}"; do
    item="${item#"${item%%[![:space:]]*}"}"
    item="${item%"${item##*[![:space:]]}"}"
    if [ -z "$item" ]; then
      printf 'Invalid empty deployment id in SIGNALS_DAEMON_DEPLOYMENT_ID=%s\n' "$raw" >&2
      exit 1
    fi
    printf '%s\n' "$item"
  done
}

start_signals_daemon() {
  local deployment_id="$1"
  local -a signals_args=(
    signals-daemon
    --deployment "$deployment_id"
    --timeframe "${SIGNALS_DAEMON_TIMEFRAME:-15}"
  )

  if [ -n "${SIGNALS_DAEMON_CHUNK:-1/1}" ]; then
    signals_args+=(--chunk "${SIGNALS_DAEMON_CHUNK:-1/1}")
  fi

  append_bool_flag --notify "${SIGNALS_DAEMON_NOTIFY:-true}"
  append_bool_flag --makeOrders "${SIGNALS_DAEMON_MAKE_ORDERS:-true}"
  append_bool_flag --showSkipStats "${SIGNALS_DAEMON_SHOW_SKIP_STATS:-true}"

  if [ -n "${SIGNALS_DAEMON_EXTRA_ARGS:-}" ]; then
    read -r -a extra_signal_args <<<"$SIGNALS_DAEMON_EXTRA_ARGS"
    signals_args+=("${extra_signal_args[@]}")
  fi

  printf 'Starting signals-daemon:'
  printf ' %q' "${signals_args[@]}"
  printf '\n'

  (
    set -o pipefail
    PROJECT_CWD=/app \
      DOTENV_CONFIG_PATH=/app/.env \
      NODE_OPTIONS="--max-old-space-size=${SIGNALS_DAEMON_HEAP_MB:-4096}" \
      ./node_modules/.bin/tradejs "${signals_args[@]}" 2>&1 | tee -a "$SIGNALS_LOG_PATH"
  ) &
  local signals_pid=$!
  signals_pids+=("$signals_pid")
  managed_pids+=("$signals_pid")
}

shutdown() {
  local exit_status="${1:-0}"

  trap - INT TERM
  for pid in "${managed_pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  for pid in "${managed_pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done

  exit "$exit_status"
}

trap 'shutdown 0' INT TERM

touch "$SIGNALS_LOG_PATH"

crond -f -P &
cron_pid=$!
managed_pids+=("$cron_pid")

while IFS= read -r deployment_id; do
  start_signals_daemon "$deployment_id"
done < <(parse_deployment_ids "$SIGNALS_DAEMON_DEPLOYMENT_ID")

(
  PROJECT_CWD=/app \
    DOTENV_CONFIG_PATH=/app/.env \
    NODE_OPTIONS="--max-old-space-size=${MARKET_WS_HEAP_MB:-256}" \
    ./node_modules/.bin/tradejs market-ws
) &
market_ws_pid=$!
managed_pids+=("$market_ws_pid")

PROJECT_CWD=/app ./node_modules/.bin/tradejs-app start &
app_pid=$!
managed_pids+=("$app_pid")

set +e
wait -n -p exited_pid "${managed_pids[@]}"
exit_status=$?
set -e

process_name="pid $exited_pid"
if [ "$exited_pid" = "$cron_pid" ]; then
  process_name='crond'
elif [ "$exited_pid" = "$market_ws_pid" ]; then
  process_name='market-ws'
elif [ "$exited_pid" = "$app_pid" ]; then
  process_name='app'
else
  for signals_pid in "${signals_pids[@]}"; do
    if [ "$exited_pid" = "$signals_pid" ]; then
      process_name='signals-daemon'
      break
    fi
  done
fi

printf 'Managed process exited: %s (status=%s)\n' "$process_name" "$exit_status" >&2
if ((exit_status == 0)); then
  exit_status=1
fi
shutdown "$exit_status"
