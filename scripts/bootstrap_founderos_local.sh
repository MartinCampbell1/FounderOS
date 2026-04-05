#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ERRORS=0

echo "=== FounderOS Local Bootstrap ==="
echo ""

# 1. Check Python
PYTHON="${PYTHON:-python3}"
PY_VERSION=$("$PYTHON" --version 2>&1 | awk '{print $2}')
echo "[1/5] Python version: $PY_VERSION"

# 2. Install shared contracts (must succeed — other planes depend on it)
echo "[2/5] Installing shared contracts..."
cd "$ROOT_DIR"
if [ ! -f "founderos_contracts/pyproject.toml" ]; then
    echo "  ERROR: founderos_contracts/pyproject.toml not found"
    exit 1
fi
# Contracts are installed into each plane's venv below; validate the package is well-formed here
"$PYTHON" -c "import tomllib; tomllib.load(open('founderos_contracts/pyproject.toml','rb'))" 2>/dev/null \
  || { echo "  ERROR: founderos_contracts/pyproject.toml is not valid TOML"; exit 1; }
echo "  ✓ Shared contracts package validated"

# 3. Bootstrap Quorum
echo "[3/5] Setting up Quorum..."
cd "$ROOT_DIR/quorum"
if [ ! -d ".venv" ]; then
    "$PYTHON" -m venv .venv
fi
VENV_PY="$PWD/.venv/bin/python"
"$VENV_PY" -m ensurepip --upgrade >/dev/null 2>&1 || true
"$VENV_PY" -m pip install -q -e ".[dev,api,research,mcp,graph]" \
    || "$VENV_PY" -m pip install -q -r requirements.txt -r requirements-dev.txt 2>/dev/null \
    || { echo "  WARNING: Quorum deps install incomplete"; ERRORS=$((ERRORS+1)); }
"$VENV_PY" -m pip install -q -e "$ROOT_DIR/founderos_contracts" \
    || { echo "  ERROR: Failed to install founderos_contracts into Quorum venv"; exit 1; }
echo "  ✓ Quorum ready"

# 4. Bootstrap Autopilot
echo "[4/5] Setting up Autopilot..."
cd "$ROOT_DIR/autopilot"
if [ ! -d ".venv" ]; then
    "$PYTHON" -m venv .venv
fi
VENV_PY="$PWD/.venv/bin/python"
"$VENV_PY" -m ensurepip --upgrade >/dev/null 2>&1 || true
"$VENV_PY" -m pip install -q -e ".[dev,api]" \
    || "$VENV_PY" -m pip install -q -e ".[api]" \
    || "$VENV_PY" -m pip install -q -e "."
"$VENV_PY" -m pip install -q -e "$ROOT_DIR/founderos_contracts" \
    || { echo "  ERROR: Failed to install founderos_contracts into Autopilot venv"; exit 1; }
echo "  ✓ Autopilot ready"

# 5. Import smoke tests
echo "[5/5] Running import smoke tests..."
SMOKE_OK=true

cd "$ROOT_DIR/quorum"
"$ROOT_DIR/quorum/.venv/bin/python" - <<'PY' || { echo "  FAIL: Quorum import smoke"; SMOKE_OK=false; ERRORS=$((ERRORS+1)); }
import orchestrator.api
print("  ✓ quorum import smoke ok")
PY

cd "$ROOT_DIR/autopilot"
"$ROOT_DIR/autopilot/.venv/bin/python" - <<'PY' || { echo "  FAIL: Autopilot import smoke"; SMOKE_OK=false; ERRORS=$((ERRORS+1)); }
import autopilot.api.main
from founderos_contracts.brief_v2 import ExecutionBriefV2
print("  ✓ autopilot + contracts import smoke ok")
PY

echo ""
if [ "$SMOKE_OK" = true ]; then
    echo "=== Bootstrap complete (${ERRORS} warnings) ==="
else
    echo "=== Bootstrap INCOMPLETE — import smoke tests failed ==="
fi
echo ""
echo "Start Quorum:    cd quorum && source .venv/bin/activate && python gateway.py"
echo "Start Autopilot: cd autopilot && source .venv/bin/activate && python -m autopilot.api.serve"
