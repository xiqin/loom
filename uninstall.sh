#!/usr/bin/env bash
# loom — 卸载脚本（用户级卸载，可 dry-run）
#
# 本地模式：
#   bash uninstall.sh --tool claude-code
#   bash uninstall.sh --tool claude-code --dry-run
#
# Release 模式（从指定版本 tag 下载）：
#   bash uninstall.sh --tool claude-code --from-release

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/scripts/common.sh"

# ── Help ───────────────────────────────────────────────────────────────
print_help() {
  cat <<'EOF'
loom 卸载脚本（用户级卸载）

USAGE
  uninstall.sh --tool <target> [flags]

FLAGS
  --tool <target>     目标工具（必填，可重复）
                      支持：claude-code | cursor | copilot | opencode | codex
  --dry-run           预览删除文件，不实际执行
  --from-release      从 GitHub release tag 下载（可重现卸载）
                      默认：本地模式（需 clone 仓库）
  --version <ver>     指定下载版本（需配合 --from-release 使用）
  --no-color          禁用颜色输出
  -h, --help          显示帮助信息

示例
  bash uninstall.sh --tool claude-code
  bash uninstall.sh --tool claude-code --dry-run
  bash uninstall.sh --tool claude-code --from-release --version 1.0.0
EOF
}

# ── Main ───────────────────────────────────────────────────────────────
main() {
  parse_args print_help "$@"
  validate_tools

  say ""
  say "  loom uninstall v$VERSION"
  say "  ${REPO}"
  say ""

  check_node

  local repo_root
  repo_root="$(detect_repo_root || true)"
  resolve_source "$repo_root"

  # Build common args
  CLI_ARGS=()
  [ "$DRY" = 1 ] && CLI_ARGS+=("--dry-run")

  # Run user-level uninstall for each tool
  for tool in "${TOOLS[@]}"; do
    say "→ $tool"
    if node "$LOOM_CLI" uninstall --tool "$tool" "${CLI_ARGS[@]}"; then
      ok "  ✔ $tool 卸载完成"
    else
      warn "  ✘ $tool 卸载失败"
      FAILURE_COUNT=$((FAILURE_COUNT + 1))
    fi
  done

  say ""
  say "  done"
  note "  若需要重新安装: bash install.sh --tool <target>"
  say ""

  if [ "$FAILURE_COUNT" -gt 0 ]; then
    exit 1
  fi
}

main "$@"
