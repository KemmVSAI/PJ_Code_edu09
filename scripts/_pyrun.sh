#!/usr/bin/env bash
# Cross-platform Python launcher for AI log hooks.
# Tries python3 → python → py -3 on PATH; on Windows, falls back to common
# Python install locations because Git Bash launched by some hooks gets a
# stripped PATH that omits the Windows Python directory.
# Designed to be sourced or called as: bash scripts/_pyrun.sh <script> [args...]
#
# Exits 0 silently if no Python is found — hooks must never block the AI tool.
set -u

# Script dir tuyệt đối — .venv nằm cạnh scripts/, resolve theo script
# thay vì cwd: hook có thể chạy từ cwd khác repo root (vd Claude Desktop
# mở thư mục cha) — khi đó .venv ở repo root vẫn phải được dùng.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -x "$REPO_ROOT/.venv/Scripts/python.exe" ]; then
  PY="$REPO_ROOT/.venv/Scripts/python.exe"
elif [ -x "$REPO_ROOT/.venv/bin/python" ]; then
  PY="$REPO_ROOT/.venv/bin/python"
elif [ -x .venv/Scripts/python.exe ]; then
  PY=".venv/Scripts/python.exe"
elif [ -x .venv/bin/python ]; then
  PY=".venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  # Tránh Windows Store alias ("Python was not found" mà exit 49)
  if python -c "import sys" >/dev/null 2>&1; then
    PY=python
  else
    PY=""
  fi
elif command -v py >/dev/null 2>&1; then
  PY="py -3"
else
  PY=""
fi

if [ -z "$PY" ]; then
  # PATH lookup failed — probe standard Windows install locations (bỏ qua
  # WindowsApps store alias: chỉ probe Python installer paths).
  shopt -s nullglob 2>/dev/null || true
  for cand in     /c/Users/*/AppData/Local/Programs/Python/Python*/python.exe     "/c/Program Files/Python"*/python.exe     "/c/Program Files (x86)/Python"*/python.exe     /c/Python*/python.exe; do
    if [ -x "$cand" ]; then PY="$cand"; break; fi
  done
  shopt -u nullglob 2>/dev/null || true
  [ -n "$PY" ] || exit 0
fi

# shellcheck disable=SC2086
exec $PY "$@"
