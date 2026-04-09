#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ERRORS=0

require_command() {
    local command_name="$1"
    if [[ "$command_name" == */* ]]; then
        if [ ! -x "$command_name" ]; then
            echo "  ERROR: required executable not found: $command_name"
            exit 1
        fi
        return
    fi

    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "  ERROR: required command not found: $command_name"
        exit 1
    fi
}

require_path() {
    local path="$1"
    if [ ! -e "$path" ]; then
        echo "  ERROR: required path missing: $path"
        exit 1
    fi
}

require_file() {
    local path="$1"
    if [ ! -f "$path" ]; then
        echo "  ERROR: required file missing: $path"
        exit 1
    fi
}

require_python_project() {
    local root_path="$1"
    local label="$2"
    if [ -f "$root_path/pyproject.toml" ] || [ -f "$root_path/setup.py" ]; then
        return
    fi

    echo "  ERROR: ${label} runtime root exists, but package metadata is missing in $root_path"
    exit 1
}

install_verification_toolchain() {
    local python_bin="$1"
    local label="$2"

    "$python_bin" -m pip install -q "ruff>=0.8" \
        || { echo "  ERROR: ${label} verification toolchain install failed"; exit 1; }
}

echo "=== FounderOS Local Bootstrap ==="
echo ""

if [ -f "$ROOT_DIR/.gitmodules" ]; then
    echo "[1/8] Initializing git submodules..."
    require_command git
    git -C "$ROOT_DIR" submodule sync --recursive
    git -C "$ROOT_DIR" submodule update --init --recursive
    echo "  ✓ Git submodules ready"
else
    echo "[1/8] No .gitmodules found; skipping submodule init"
fi

echo "[2/8] Validating runtime roots..."
require_path "$ROOT_DIR/quorum"
require_file "$ROOT_DIR/quorum/gateway.py"
require_python_project "$ROOT_DIR/quorum" "Quorum"
require_path "$ROOT_DIR/autopilot"
require_python_project "$ROOT_DIR/autopilot" "Autopilot"
require_file "$ROOT_DIR/founderos_contracts/pyproject.toml"
require_file "$ROOT_DIR/package-lock.json"
echo "  ✓ Runtime roots verified"

PYTHON="${PYTHON:-python3}"
require_command "$PYTHON"
PY_VERSION=$("$PYTHON" --version 2>&1 | awk '{print $2}')
echo "[3/8] Python version: $PY_VERSION"
export PIP_CONSTRAINT="$ROOT_DIR/constraints-python.txt"

echo "[4/8] Validating shared contracts package..."
cd "$ROOT_DIR"
"$PYTHON" -c "import tomllib; tomllib.load(open('founderos_contracts/pyproject.toml','rb'))" 2>/dev/null \
  || { echo "  ERROR: founderos_contracts/pyproject.toml is not valid TOML"; exit 1; }
echo "  ✓ Shared contracts package validated"

echo "[5/8] Setting up Quorum..."
cd "$ROOT_DIR/quorum"
if [ ! -d ".venv" ]; then
    "$PYTHON" -m venv .venv
fi
VENV_PY="$PWD/.venv/bin/python"
"$VENV_PY" -m ensurepip --upgrade >/dev/null 2>&1 || true
"$VENV_PY" -m pip install -q -e ".[dev,api,research,mcp,graph]" \
    || "$VENV_PY" -m pip install -q -r requirements.txt -r requirements-dev.txt \
    || { echo "  ERROR: Quorum deps install failed"; exit 1; }
"$VENV_PY" -m pip install -q -e "$ROOT_DIR/founderos_contracts" \
    || { echo "  ERROR: Failed to install founderos_contracts into Quorum venv"; exit 1; }
install_verification_toolchain "$VENV_PY" "Quorum"
echo "  ✓ Quorum ready"

echo "[6/8] Setting up Autopilot..."
cd "$ROOT_DIR/autopilot"
if [ ! -d ".venv" ]; then
    "$PYTHON" -m venv .venv
fi
VENV_PY="$PWD/.venv/bin/python"
"$VENV_PY" -m ensurepip --upgrade >/dev/null 2>&1 || true
"$VENV_PY" -m pip install -q -e ".[dev,api]" \
    || "$VENV_PY" -m pip install -q -e ".[api]" \
    || "$VENV_PY" -m pip install -q -e "." \
    || { echo "  ERROR: Autopilot deps install failed"; exit 1; }
"$VENV_PY" -m pip install -q -e "$ROOT_DIR/founderos_contracts" \
    || { echo "  ERROR: Failed to install founderos_contracts into Autopilot venv"; exit 1; }
install_verification_toolchain "$VENV_PY" "Autopilot"
echo "  ✓ Autopilot ready"

echo "[7/8] Installing Node workspace dependencies..."
cd "$ROOT_DIR"
require_command npm
npm ci
echo "  ✓ Node workspace deps installed"

echo "[8/8] Running smoke tests..."
SMOKE_OK=true

cd "$ROOT_DIR/quorum"
if "$ROOT_DIR/quorum/.venv/bin/python" - <<'PY'
import orchestrator.api
print("  ✓ quorum import smoke ok")
PY
then
    :
else
    echo "  FAIL: Quorum import smoke"
    SMOKE_OK=false
    ERRORS=$((ERRORS+1))
fi

cd "$ROOT_DIR/autopilot"
if "$ROOT_DIR/autopilot/.venv/bin/python" - <<'PY'
import autopilot.api.main
from founderos_contracts.brief_v2 import ExecutionBriefV2

print("  ✓ autopilot + contracts import smoke ok")
PY
then
    :
else
    echo "  FAIL: Autopilot import smoke"
    SMOKE_OK=false
    ERRORS=$((ERRORS+1))
fi

cd "$ROOT_DIR"
if npm run build --workspace @founderos/web; then
    echo "  ✓ web build smoke ok"
else
    echo "  FAIL: web build smoke"
    SMOKE_OK=false
    ERRORS=$((ERRORS+1))
fi

echo ""
if [ "$SMOKE_OK" = true ]; then
    echo "=== Bootstrap complete (${ERRORS} warnings) ==="
else
    echo "=== Bootstrap INCOMPLETE — import smoke or build smoke failed ==="
    exit 1
fi
echo ""
echo "Start Quorum:    cd quorum && source .venv/bin/activate && python gateway.py"
echo "Start Autopilot: cd autopilot && source .venv/bin/activate && python -m autopilot.api.serve"
