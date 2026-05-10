#!/usr/bin/env bash
# loom — 卸载脚本（安全、可审计、可 dry-run）
#
# 本地模式：
#   bash uninstall.sh --tool claude-code
#   bash uninstall.sh --tool claude-code --dry-run
#
# Release 模式（从指定版本 tag 下载）：
#   bash uninstall.sh --tool claude-code --from-release
#   bash uninstall.sh --tool claude-code --from-release --version 版本号

set -euo pipefail

REPO="xiqin/loom"
VERSION="1.1.0"

# ── Flags ──────────────────────────────────────────────────────────────
DRY=0
PURGE=0
FROM_RELEASE=0
VERSION_FLAG=""
TOOLS=()
NO_COLOR=0

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
loom 卸载脚本

USAGE
  uninstall.sh --tool <target> [flags]

FLAGS
  --tool <target>     目标工具（必填，可重复）
                      支持：claude-code | cursor | copilot | opencode | codex
  --version <ver>     指定版本（默认取脚本内嵌版本）
  --dry-run           预览删除文件，不实际执行
  --from-release      从 GitHub release tag 下载（可重现卸载）
                      默认：本地模式（需 clone 仓库）
  --purge             额外清理：移除备份目录和 .gitignore 条目
  --no-color          禁用颜色输出
  -h, --help          显示帮助信息

安全策略
  - 只删除 install-manifest.json 中记录的文件
  - 文件被用户修改后不会删除（输出 warning）
  --purge 也不能越过 manifest 边界

示例
  bash uninstall.sh --tool claude-code
  bash uninstall.sh --tool claude-code --dry-run
  bash uninstall.sh --tool claude-code --purge
  bash uninstall.sh --tool claude-code --from-release --version 版本号
EOF
}

# ── Parse args ─────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --tool)
      shift
      if [ $# -eq 0 ]; then err "error: --tool requires an argument"; exit 2; fi
      TOOLS+=("$1") ;;
    --version)
      shift
      if [ $# -eq 0 ]; then err "error: --version requires an argument"; exit 2; fi
      VERSION_FLAG="$1" ;;
    --dry-run)       DRY=1 ;;
    --purge)         PURGE=1 ;;
    --from-release)  FROM_RELEASE=1 ;;
    --no-color)      NO_COLOR=1 ;;
    -h|--help)       print_help; exit 0 ;;
    *)
      err "error: unknown flag: $1"; echo "run 'uninstall.sh --help' for usage"; exit 2 ;;
  esac
  shift
done

# ── Validate ───────────────────────────────────────────────────────────
SUPPORTED_TOOLS=("claude-code" "cursor" "copilot" "opencode" "codex")
if [ ${#TOOLS[@]} -eq 0 ]; then
  err "error: --tool is required"
  echo "  Supported: ${SUPPORTED_TOOLS[*]}"
  echo "  Example: bash uninstall.sh --tool claude-code"
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

# ── Resolve version ───────────────────────────────────────────────────
INSTALL_VERSION="${VERSION_FLAG:-$VERSION}"

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

  note "  mode: release (v$INSTALL_VERSION)"
  CLEANUP_DIR="$(mktemp -d)"
  local tarball="$CLEANUP_DIR/loom.tar.gz"

  say "  downloading loom v$INSTALL_VERSION from $REPO..."
  curl -fsSL "https://github.com/$REPO/archive/refs/tags/v$INSTALL_VERSION.tar.gz" -o "$tarball"

  note "  extracting..."
  tar xzf "$tarball" -C "$CLEANUP_DIR"

  local extracted="$CLEANUP_DIR/loom-$INSTALL_VERSION"
  if [ ! -d "$extracted" ]; then
    extracted=$(find "$CLEANUP_DIR" -maxdepth 1 -type d | tail -1)
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
  say "  loom uninstall v$INSTALL_VERSION"
  say "  ${REPO}"
  say ""

  check_node
  resolve_source

  # Build common args
  CLI_ARGS=("--version" "$INSTALL_VERSION")
  [ "$DRY" = 1 ] && CLI_ARGS+=("--dry-run")
  [ "$PURGE" = 1 ] && CLI_ARGS+=("--purge")

  # Run uninstall for each tool
  for tool in "${TOOLS[@]}"; do
    say "→ $tool"
    if node "$LOOM_CLI" uninstall --tool "$tool" "${CLI_ARGS[@]}"; then
      ok "  ✔ $tool 卸载完成"
    else
      warn "  ✘ $tool 卸载失败（可能未安装或 manifest 缺失）"
    fi
  done

  say ""
  say "  done"
  note "  若需要重新安装: bash install.sh --tool <target>"
  say ""
}

main
