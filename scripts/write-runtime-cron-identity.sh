#!/usr/bin/env bash

set -Eeuo pipefail

readonly output_path="${1:-/run/tradejs/runtime-cron-identity.env}"
readonly project_sha="${TRADEJS_PROJECT_SHA:-}"
readonly image_digest="${TRADEJS_PROJECT_IMAGE_DIGEST:-}"

if [[ ! "$project_sha" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'TRADEJS_PROJECT_SHA must be a full lowercase Git SHA before starting cron\n' >&2
  exit 1
fi
if [[ ! "$image_digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  printf 'TRADEJS_PROJECT_IMAGE_DIGEST must be an immutable sha256 digest before starting cron\n' >&2
  exit 1
fi

readonly output_directory="$(dirname "$output_path")"
install -d -m 700 "$output_directory"

temporary_path="$(mktemp "${output_path}.tmp.XXXXXX")"
cleanup() {
  rm -f "$temporary_path"
}
trap cleanup EXIT

{
  printf 'export TRADEJS_PROJECT_SHA=%s\n' "$project_sha"
  printf 'export TRADEJS_PROJECT_IMAGE_DIGEST=%s\n' "$image_digest"
} >"$temporary_path"
chmod 600 "$temporary_path"
mv "$temporary_path" "$output_path"
trap - EXIT
