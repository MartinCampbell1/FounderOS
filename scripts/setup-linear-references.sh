#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REFERENCES_DIR="${ROOT_DIR}/.linear-references"
ARTIFACTS_DIR="${ROOT_DIR}/.linear-artifacts"

clone_or_update() {
  local name="$1"
  local url="$2"
  local target="${REFERENCES_DIR}/${name}"

  if [[ -d "${target}/.git" ]]; then
    git -C "${target}" pull --ff-only
    return
  fi

  git clone --depth 1 "${url}" "${target}"
}

mkdir -p "${REFERENCES_DIR}" "${ARTIFACTS_DIR}/fontofweb"

clone_or_update "rebuilding-linear.app" "https://github.com/frontendfyi/rebuilding-linear.app.git"
clone_or_update "linear-clone" "https://github.com/thenameiswiiwin/linear-clone.git"

curl -L --max-time 30 -A "Mozilla/5.0" "https://fontofweb.com/tokens/linear.app" \
  -o "${ARTIFACTS_DIR}/fontofweb/linear.app.html"

printf 'Synced Linear references into %s\n' "${REFERENCES_DIR}"
printf 'Saved FontOfWeb snapshot into %s\n' "${ARTIFACTS_DIR}/fontofweb/linear.app.html"
