#!/usr/bin/env bash
# rss — 一键卸载脚本
#
# 使用方式：
#   # 本地模式（从 clone 的仓库运行）
#   bash uninstall.sh --tool claude-code
#   bash uninstall.sh --tool claude-code --tool cursor --purge
#
#   # 远程模式（curl 一键卸载）
#   curl -fsSL https://raw.githubusercontent.com/xiqin/rss/main/uninstall.sh | bash -s -- --tool claude-code

set -euo pipefail

REPO="xiqin/rss"
RAW_BASE="https://raw.githubusercontent.com/$REPO/main"
VERSION="1.0.0"

# ── Flags ──────────────────────────────────────────────────────────────
DRY=0
PURGE=0
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
rss 一键卸载脚本

USAGE
  uninstall.sh [flags]

  本地模式（仓库内）：
    bash uninstall.sh --tool claude-code

  远程模式（curl 管道）：
    curl -fsSL https://raw.githubusercontent.com/xiqin/rss/main/uninstall.sh | bash -s -- --tool claude-code

FLAGS
  --tool <target>   目标工具（必填，可重复）
                    支持：claude-code | cursor | copilot | opencode | codex
  --purge           额外清理：移除全局 rss CLI、删除 .rss-backup/ 备份目录
  --dry-run         预览，不实际执行
  --no-color        禁用颜色输出
  -h, --help        显示帮助信息

示例
  bash uninstall.sh --tool claude-code                     # 卸载 Claude Code
  bash uninstall.sh --tool claude-code --tool cursor       # 卸载两个工具
  bash uninstall.sh --tool opencode --purge                # 卸载 OpenCode + 清理全局 CLI
EOF
}

# ── Parse args ─────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --tool)
      shift
      if [ $# -eq 0 ]; then err "error: --tool requires an argument"; exit 2; fi
      TOOLS+=("$1") ;;
    --purge)      PURGE=1 ;;
    --dry-run)    DRY=1 ;;
    --no-color)   NO_COLOR=1 ;;
    -h|--help)    print_help; exit 0 ;;
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
  # First try: use globally installed rss CLI
  if command -v rss >/dev/null 2>&1; then
    RSS_CLI="rss"
    note "  mode: global CLI"
    return 0
  fi

  # Second try: local repo clone
  if [ -n "$REPO_ROOT" ]; then
    RSS_CLI="$REPO_ROOT/bin/rss.js"
    note "  mode: local ($REPO_ROOT)"
    return 0
  fi

  # Third try: download remote
  if ! command -v curl >/dev/null 2>&1; then
    err "error: curl is required. Install curl or use a local clone."
    exit 1
  fi

  note "  mode: remote (curl-pipe)"
  CLEANUP_DIR="$(mktemp -d)"
  local tarball="$CLEANUP_DIR/rss.tar.gz"

  say "  downloading rss from $REPO..."
  curl -fsSL "https://github.com/$REPO/archive/main.tar.gz" -o "$tarball"

  note "  extracting..."
  tar xzf "$tarball" -C "$CLEANUP_DIR"
  local extracted="$CLEANUP_DIR/rss-main"
  if [ ! -d "$extracted" ]; then
    extracted=$(find "$CLEANUP_DIR" -maxdepth 1 -type d | tail -1)
  fi

  if [ ! -f "$extracted/bin/rss.js" ]; then
    err "error: download appears incomplete"
    rm -rf "$CLEANUP_DIR"
    exit 1
  fi

  RSS_CLI="$extracted/bin/rss.js"
}

cleanup() {
  if [ -n "$CLEANUP_DIR" ] && [ -d "$CLEANUP_DIR" ]; then
    rm -rf "$CLEANUP_DIR"
  fi
}
trap cleanup EXIT

# ── Main ───────────────────────────────────────────────────────────────
main() {
  local pwd_before="$PWD"

  say ""
  say "  rss uninstall v$VERSION"
  say "  ${REPO}"
  say ""

  resolve_source

  # Build CLI args
  CLI_ARGS=()
  [ "$DRY" = 1 ] && CLI_ARGS+=("--dry-run")

  # Run uninstall for each tool
  for tool in "${TOOLS[@]}"; do
    say "→ $tool"

    # The uninstall command uses process.cwd(), so we need to be in the target project
    # Ask user to cd to the project directory first
    if [ "$DRY" = 1 ]; then
      note "  would run: node $RSS_CLI uninstall --tool $tool"
    else
      if node "$RSS_CLI" uninstall --tool "$tool" "${CLI_ARGS[@]}"; then
        ok "  ✔ $tool 卸载完成"
      else
        warn "  ✘ $tool 卸载失败（项目目录中可能未安装 rss）"
        note "  请确认在目标项目的根目录运行此脚本"
      fi
    fi
  done

  # --purge: additional cleanup
  if [ "$PURGE" = 1 ]; then
    say "→ 清理全局残留"

    # Remove global rss CLI
    if command -v rss >/dev/null 2>&1; then
      if [ "$DRY" = 1 ]; then
        note "  would run: npm uninstall -g rss-engineering"
      else
        # Try both possible package names
        npm uninstall -g rss-engineering 2>/dev/null || true
        npm uninstall -g rss 2>/dev/null || true
        ok "  ✔ 全局 rss CLI 已移除"
      fi
    fi

    # Remove npm link if running from local clone
    if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/package.json" ]; then
      local pkg_name
      pkg_name=$(node -e "console.log(require('$REPO_ROOT/package.json').name || '')" 2>/dev/null || true)
      if [ -n "$pkg_name" ]; then
        if [ "$DRY" = 1 ]; then
          note "  would run: npm unlink -g $pkg_name"
        else
          npm unlink -g "$pkg_name" 2>/dev/null || true
        fi
      fi
    fi

    # Remove .rss-backup directory in current project
    if [ -d ".rss-backup" ]; then
      if [ "$DRY" = 1 ]; then
        note "  would run: rm -rf .rss-backup/ (in $PWD)"
      else
        rm -rf ".rss-backup"
        ok "  ✔ .rss-backup/ 已删除"
      fi
    fi

    # Remove .gitignore entry
    if [ -f ".gitignore" ]; then
      if [ "$DRY" = 1 ]; then
        note "  would clean .gitignore rss entries (in $PWD)"
      else
        if [[ "$OSTYPE" == "darwin"* ]]; then
          sed -i '' '/\.rss-backup\//d; /# rss-engineering/d' ".gitignore" 2>/dev/null || true
        else
          sed -i '/\.rss-backup\//d; /# rss-engineering/d' ".gitignore" 2>/dev/null || true
        fi
        ok "  ✔ .gitignore rss 条目已清理"
      fi
    fi
  fi

  say ""
  say "  done"
  note "  若需要重新安装: bash install.sh --tool <target>"
  say ""
}

main
