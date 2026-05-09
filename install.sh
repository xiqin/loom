#!/usr/bin/env bash
# rss — 一键安装脚本
#
# 使用方式：
#   # 本地模式（从 clone 的仓库运行）
#   bash install.sh --tool claude-code
#   bash install.sh --tool claude-code --tool cursor --link
#
#   # 远程模式（curl 一键安装）
#   curl -fsSL https://raw.githubusercontent.com/xiqin/rss/main/install.sh | bash -s -- --tool claude-code
#
# 支持的工具：claude-code | cursor | copilot | opencode | codex

set -euo pipefail

REPO="xiqin/rss"
RAW_BASE="https://raw.githubusercontent.com/$REPO/main"
VERSION="1.0.0"

# ── Flags ──────────────────────────────────────────────────────────────
DRY=0
FORCE=0
LINK=0
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
rss 一键安装脚本

USAGE
  install.sh [flags]

  本地模式（仓库内）：
    bash install.sh --tool claude-code

  远程模式（curl 管道）：
    curl -fsSL https://raw.githubusercontent.com/xiqin/rss/main/install.sh | bash -s -- --tool claude-code

FLAGS
  --tool <target>   目标工具（必填，可重复）
                    支持：claude-code | cursor | copilot | opencode | codex
                    例：--tool claude-code --tool cursor
  --force           覆盖已有文件（自动备份）
  --link            将 rss CLI 注册到全局（npm link）
  --dry-run         预览，不实际写入
  --no-color        禁用颜色输出
  -h, --help        显示帮助信息

示例
  bash install.sh --tool claude-code                         # 安装到 Claude Code
  bash install.sh --tool claude-code --tool cursor --link    # 安装到两个工具 + 全局 CLI
  bash install.sh --tool opencode --force                    # 强制覆盖安装到 OpenCode
  curl -fsSL https://raw.githubusercontent.com/xiqin/rss/main/install.sh | bash -s -- --tool cursor
EOF
}

# ── Parse args ─────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --tool)
      shift
      if [ $# -eq 0 ]; then err "error: --tool requires an argument"; exit 2; fi
      TOOLS+=("$1") ;;
    --dry-run)    DRY=1 ;;
    --force)      FORCE=1 ;;
    --link)       LINK=1 ;;
    --no-color)   NO_COLOR=1 ;;
    -h|--help)    print_help; exit 0 ;;
    *)
      err "error: unknown flag: $1"; echo "run 'install.sh --help' for usage"; exit 2 ;;
  esac
  shift
done

# ── Validate ───────────────────────────────────────────────────────────
SUPPORTED_TOOLS=("claude-code" "cursor" "copilot" "opencode" "codex")
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

# ── Detect repo root ───────────────────────────────────────────────────
detect_repo_root() {
  local src="${BASH_SOURCE[0]:-}"
  if [ -n "$src" ] && [ -f "$src" ]; then
    local d
    d="$(cd "$(dirname "$src")" 2>/dev/null && pwd)"
    if [ -n "$d" ] && [ -f "$d/bin/rss.js" ] && [ -f "$d/package.json" ]; then
      echo "$d"
      return 0
    fi
  fi
  return 1
}

REPO_ROOT="$(detect_repo_root || true)"

# ── Resolve RSS source ─────────────────────────────────────────────────
RSS_CLI=""
CLEANUP_DIR=""

resolve_source() {
  if [ -n "$REPO_ROOT" ]; then
    note "  mode: local ($REPO_ROOT)"
    RSS_CLI="$REPO_ROOT/bin/rss.js"
    return 0
  fi

  note "  mode: remote (curl-pipe)"
  if ! command -v curl >/dev/null 2>&1; then
    err "error: curl is required for remote install"
    exit 1
  fi
  if ! command -v tar >/dev/null 2>&1; then
    err "error: tar is required for remote install"
    exit 1
  fi

  CLEANUP_DIR="$(mktemp -d)"
  local tarball="$CLEANUP_DIR/rss.tar.gz"

  say "  downloading rss from $REPO..."
  curl -fsSL "https://github.com/$REPO/archive/main.tar.gz" -o "$tarball"

  note "  extracting..."
  tar xzf "$tarball" -C "$CLEANUP_DIR"

  local extracted="$CLEANUP_DIR/rss-main"
  if [ ! -d "$extracted" ]; then
    # Try alternative extraction dir name (GitHub may use different formats)
    extracted=$(find "$CLEANUP_DIR" -maxdepth 1 -type d | tail -1)
  fi

  if [ ! -f "$extracted/bin/rss.js" ]; then
    err "error: download appears incomplete — bin/rss.js not found"
    rm -rf "$CLEANUP_DIR"
    exit 1
  fi

  note "  installing dependencies..."
  (cd "$extracted" && npm install --production 2>/dev/null) || \
    warn "  warning: npm install failed, some features may not work"

  RSS_CLI="$extracted/bin/rss.js"
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
  say "  rss install v$VERSION"
  say "  ${REPO}"
  say ""

  check_node
  resolve_source

  # Build common args
  CLI_ARGS=()
  [ "$DRY" = 1 ] && CLI_ARGS+=("--dry-run")
  [ "$FORCE" = 1 ] && CLI_ARGS+=("--force")

  # Run init for each tool
  for tool in "${TOOLS[@]}"; do
    say "→ $tool"
    if [ "$DRY" = 1 ]; then
      note "  would run: node $RSS_CLI init --tool $tool ${CLI_ARGS[*]}"
    else
      if node "$RSS_CLI" init --tool "$tool" "${CLI_ARGS[@]}"; then
        ok "  ✔ $tool 安装完成"
      else
        warn "  ✘ $tool 安装失败"
      fi
    fi
  done

  # Optional: npm link for global CLI
  if [ "$LINK" = 1 ]; then
    if [ -n "$REPO_ROOT" ]; then
      note "  registering rss CLI globally (npm link)..."
      if [ "$DRY" = 1 ]; then
        note "  would run: npm link in $REPO_ROOT"
      else
        if (cd "$REPO_ROOT" && npm link 2>/dev/null); then
          ok "  ✔ rss CLI 已注册到全局，运行 'rss --help' 验证"
        else
          warn "  ✘ npm link 失败，手动运行: cd $REPO_ROOT && npm link"
        fi
      fi
    else
      warn "  --link 仅在本地模式有效（远程模式下载到临时目录）"
      warn "  安装后手动进入项目目录运行 'npm link'"
    fi
  fi

  say ""
  say "  done"
  note "  可用命令: rss doctor, rss list, rss update"
  if [ "$LINK" = 0 ]; then
    note "  要在项目中使用 rss CLI，运行: node $RSS_CLI <command>"
    note "  或通过 --link 注册到全局"
  fi
  note "  卸载: bash $(dirname "$RSS_CLI")/../uninstall.sh --tool <target>"
  say ""
}

main
