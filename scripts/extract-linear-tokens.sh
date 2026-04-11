#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_DIR="${ROOT_DIR}/.linear-artifacts/dembrandt"
TARGET_URL="${DEMBRANDT_URL:-https://linear.app}"
MAX_OLD_SPACE_SIZE="${DEMBRANDT_MAX_OLD_SPACE_SIZE:-512}"
MODE="${1:-both}"

mkdir -p "${ARTIFACTS_DIR}"

extract_mode() {
  local label="$1"
  shift
  local work_dir
  local output_dir
  local latest
  work_dir="$(mktemp -d "${ARTIFACTS_DIR}/run-${label}-XXXXXX")"
  output_dir="${work_dir}/output"

  (
    cd "${work_dir}"
    NODE_OPTIONS="--max-old-space-size=${MAX_OLD_SPACE_SIZE}" npx -y dembrandt "${TARGET_URL}" --dtcg --save-output "$@"
  )

  if [[ ! -d "${output_dir}" ]]; then
    printf 'Dembrandt did not create an output directory for %s mode.\n' "${label}" >&2
    exit 1
  fi

  latest="$(find "${output_dir}" -name "*.tokens.json" -type f | sort | tail -n 1)"

  if [[ -z "${latest}" ]]; then
    printf 'Dembrandt did not produce a %s token file.\n' "${label}" >&2
    exit 1
  fi

  cp "${latest}" "${ARTIFACTS_DIR}/linear.${label}.tokens.json"
  rm -rf "${work_dir}"
}

case "${MODE}" in
  light)
    extract_mode "light"
    ;;
  dark)
    extract_mode "dark" --dark-mode
    ;;
  both)
    extract_mode "light"
    extract_mode "dark" --dark-mode
    ;;
  *)
    printf 'Usage: %s [light|dark|both]\n' "${0##*/}" >&2
    exit 1
    ;;
esac

printf 'Saved Dembrandt tokens into %s\n' "${ARTIFACTS_DIR}"
