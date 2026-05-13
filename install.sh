#!/usr/bin/env bash
# loom — 安装脚本（用户级安装，可重现、可 dry-run）
#
# 本地模式：
#   bash install.sh --tool claude-code
#   bash install.sh --tool claude-code --dry-run
#
# Release 模式（从指定版本 tag 下载）：
#   bash install.sh --tool claude-code --from-release
#   bash install.sh --tool claude-code --from-release --version 1.0.0

set -euo pipefail

REPO="xiqin/loom"
VERSION="1.3.2"
# AUTO-SYNC: updated by scripts/generate-tooling.mjs and scripts/sync-version.mjs
SUPPORTED_TOOLS=("claude-code" "cursor" "copilot" "opencode" "codex")

# ── Flags ──────────────────────────────────────────────────────────────
DRY=0
FROM_RELEASE=0
TOOLS=()
NO_COLOR=0
FAILURE_COUNT=0

# ── Color ──────────────────────────────────────────────────────────────
if [ ! -t 1 ]; then NO_COLOR=1; fi
if [ "$NO_COLOR" = 1 ]; then
  c_info=""; c_dim=""; c_ok=""; c_warn=""; c_err=""; c_reset=""
else
  c_info=$'\033[38;5;39m'
  c_dim=$'\033[2m'
  c_ok=$'\033[32m'
  c_warn=$'\033[33m'
  c_err=$'\033[31m'
  c_reset=$'\033[0m'
fi

say()   { printf '%s%s%s\n' "$c_info" "$1" "$c_reset"; }
note()  { printf '%s%s%s\n' "$c_dim" "$1" "$c_reset"; }
ok()    { printf '%s%s%s\n' "$c_ok" "$1" "$c_reset"; }
warn()  { printf '%s%s%s\n' "$c_warn" "$1" "$c_reset" >&2; }
err()   { printf '%s%s%s\n' "$c_err" "$1" "$c_reset" >&2; }

# ── Help ───────────────────────────────────────────────────────────────
print_help() {
  cat <<'EOF'
loom 安装脚本（用户级安装）

USAGE
  install.sh --tool <target> [flags]

FLAGS
  --tool <target>     目标工具（必填，可重复）
                      支持：claude-code | cursor | copilot | opencode | codex
  --dry-run           预览安装文件，不实际写入
  --from-release      从 GitHub release tag 下载（可重现安装）
                      默认：本地模式（需 clone 仓库）
  --version <ver>     指定下载版本（需配合 --from-release 使用）
  --no-color          禁用颜色输出
  -h, --help          显示帮助信息

示例
  # 用户级安装（在 clone 的仓库内运行）
  bash install.sh --tool claude-code

  # 预览安装
  bash install.sh --tool claude-code --dry-run

  # 从指定版本 release 安装（远程，可重现）
  bash install.sh --tool claude-code --from-release --version 1.0.0

  # 多工具安装
  bash install.sh --tool claude-code --tool cursor
EOF
}

# ── Parse args ─────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --tool)
      shift
      if [ $# -eq 0 ]; then err "error: --tool requires an argument"; exit 2; fi
      TOOLS+=("$1") ;;
    --dry-run)       DRY=1 ;;
    --from-release)  FROM_RELEASE=1 ;;
    --no-color)      NO_COLOR=1 ;;
    --version)
      shift
      if [ $# -eq 0 ]; then err "error: --version requires an argument"; exit 2; fi
      VERSION="$1" ;;
    -h|--help)       print_help; exit 0 ;;
    *)
      err "error: unknown flag: $1"; echo "run 'install.sh --help' for usage"; exit 2 ;;
  esac
  shift
done

# ── Validate ───────────────────────────────────────────────────────────
if [ ${#TOOLS[@]} -eq 0 ]; then
  err "error: --tool is required"
  echo "  Supported: ${SUPPORTED_TOOLS[*]}"
  echo "  Example: bash install.sh --tool claude-code"
  exit 2
fi
for t in "${TOOLS[@]}"; do
  valid=0
  for s in "${SUPPORTED_TOOLS[@]}"; do [ "$t" = "$s" ] && valid=1; done
  if [ "$valid" = 0 ]; then
    err "error: unsupported tool '$t'. Supported: ${SUPPORTED_TOOLS[*]}"
    exit 2
  fi
done

# ── Detect repo root ──────────────────────────────────────────────────
detect_repo_root() {
  local src="${BASH_SOURCE[0]:-}"
  if [ -n "$src" ] && [ -f "$src" ]; then
    local d
    d="$(cd "$(dirname "$src")" 2>/dev/null && pwd)"
    if [ -n "$d" ] && [ -f "$d/bin/loom.js" ] && [ -f "$d/package.json" ]; then
      echo "$d"
      return 0
    fi
  fi
  return 1
}

REPO_ROOT="$(detect_repo_root || true)"

# ── Resolve loom source ─────────────────────────────────────────────────
LOOM_CLI=""
CLEANUP_DIR=""

resolve_source() {
  if [ "$FROM_RELEASE" = 0 ] && [ -n "$REPO_ROOT" ]; then
    note "  mode: local ($REPO_ROOT)"
    LOOM_CLI="$REPO_ROOT/bin/loom.js"
    return 0
  fi

  # Remote: download from release tag
  if ! command -v curl >/dev/null 2>&1; then
    err "error: curl is required for --from-release"
    exit 1
  fi
  if ! command -v tar >/dev/null 2>&1; then
    err "error: tar is required for --from-release"
    exit 1
  fi

  note "  mode: release (v$VERSION)"
  CLEANUP_DIR="$(mktemp -d)"
  local tarball="$CLEANUP_DIR/loom.tar.gz"

  say "  downloading loom v$VERSION from $REPO..."
  curl -fsSL "https://github.com/$REPO/archive/refs/tags/v$VERSION.tar.gz" -o "$tarball"

  note "  extracting..."
  tar xzf "$tarball" -C "$CLEANUP_DIR"
  if [ $? -ne 0 ]; then
    err "error: extraction failed"
    rm -rf "$CLEANUP_DIR"
    exit 1
  fi

  local extracted="$CLEANUP_DIR/loom-$VERSION"
  if [ ! -d "$extracted" ]; then
    extracted="$(ls -d "$CLEANUP_DIR"/*/ 2>/dev/null | head -1)"
    extracted="${extracted%/}"
  fi

  if [ ! -f "$extracted/bin/loom.js" ]; then
    err "error: download appears incomplete — bin/loom.js not found"
    rm -rf "$CLEANUP_DIR"
    exit 1
  fi

  note "  installing dependencies..."
  (cd "$extracted" && npm install --production 2>/dev/null) || \
    warn "  warning: npm install failed, some features may not work"

  LOOM_CLI="$extracted/bin/loom.js"
}

cleanup() {
  if [ -n "$CLEANUP_DIR" ] && [ -d "$CLEANUP_DIR" ]; then
    rm -rf "$CLEANUP_DIR"
  fi
}
trap cleanup EXIT

# ── Check Node.js ──────────────────────────────────────────────────────
check_node() {
  if ! command -v node >/dev/null 2>&1; then
    err "error: Node.js is required (https://nodejs.org)"
    err "  Install Node.js >= 18 and re-run"
    exit 1
  fi
  local node_ver
  node_ver="$(node -v | sed 's/v//' | cut -d. -f1)"
  if [ "$node_ver" -lt 18 ]; then
    err "error: Node.js >= 18 required (found: $(node -v))"
    exit 1
  fi
}

# ── Main ───────────────────────────────────────────────────────────────
main() {
  say ""
  say "  loom install v$VERSION"
  say "  ${REPO}"
  say ""

  check_node
  resolve_source

  # Build common args
  CLI_ARGS=()
  [ "$DRY" = 1 ] && CLI_ARGS+=("--dry-run")

  # Run user-level install for each tool
  for tool in "${TOOLS[@]}"; do
    say "→ $tool"
    if node "$LOOM_CLI" install --tool "$tool" "${CLI_ARGS[@]}"; then
      ok "  ✔ $tool 用户级安装完成"
    else
      warn "  ✘ $tool 安装失败"
      FAILURE_COUNT=$((FAILURE_COUNT + 1))
    fi
  done

  say ""
  say "  done"
  note "  可用命令: loom doctor, loom list"
  note "  卸载: bash uninstall.sh --tool <target>"
  say ""

  if [ "$FAILURE_COUNT" -gt 0 ]; then
    exit 1
  fi
}

main
