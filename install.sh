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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/common.sh"

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

# ── Main ───────────────────────────────────────────────────────────────
main() {
  parse_args print_help "$@"
  validate_tools

  say ""
  say "  loom install v$VERSION"
  say "  ${REPO}"
  say ""

  check_node

  local repo_root
  repo_root="$(detect_repo_root || true)"
  resolve_source "$repo_root"

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

main "$@"
