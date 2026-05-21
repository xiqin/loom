# loom — 安装脚本（用户级安装，可重现、可 dry-run）
#
# 本地模式：
#   .\install.ps1 -Tool claude-code
#   .\install.ps1 -Tool claude-code -DryRun
#
# Release 模式（从指定版本 tag 下载）：
#   .\install.ps1 -Tool claude-code -FromRelease
#   .\install.ps1 -Tool claude-code -FromRelease -Version 1.0.0

[CmdletBinding()]
param(
  [string[]]$Tool = @(),
  [string]$Version,
  [switch]$DryRun,
  [switch]$FromRelease,
  [switch]$NoColor,
  [switch]$Help
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. "$ScriptDir\scripts\common.ps1"

# ── Help ────────────────────────────────────────────────────────────────
if ($Help) {
@"
loom 安装脚本（用户级安装）

USAGE
  install.ps1 -Tool <target> [flags]

FLAGS
  -Tool <target>      目标工具（必填，逗号分隔或重复指定）
                       支持：claude-code | cursor | copilot | opencode | codex
  -DryRun             预览安装文件，不实际写入
  -FromRelease        从 GitHub release tag 下载（可重现安装）
                       默认：本地模式（需 clone 仓库）
  -Version <ver>      指定下载版本（需配合 -FromRelease 使用）
  -NoColor            禁用颜色输出
  -Help               显示帮助信息

示例
  .\install.ps1 -Tool claude-code                         # 用户级安装
  .\install.ps1 -Tool claude-code -DryRun                 # 预览安装
  .\install.ps1 -Tool claude-code -FromRelease            # 从 release 安装
"@
  exit 0
}

# ── Main ────────────────────────────────────────────────────────────────
try {
  Validate-Tools

  Say ""
  Say "  loom install v$Version"
  Say "  $Repo"
  Say ""

  Check-Node
  Resolve-Source

  # Build CLI args
  $cliArgs = @("install")
  if ($DryRun) { $cliArgs += "--dry-run" }

  $failureCount = 0

  foreach ($t in $Tools) {
    Say "→ $t"
    $fullArgs = $cliArgs + @("--tool", $t)

    Write-Host "  $ node $LoomCli $($fullArgs -join ' ')"
    try {
      & node $LoomCli @fullArgs
      if ($LASTEXITCODE -eq 0) {
        Ok "  ✔ $t 用户级安装完成"
      } else {
        Warn "  ✘ $t 安装失败"
        $failureCount++
      }
    } catch {
      Warn "  ✘ $t 安装失败: $($_.Exception.Message)"
      $failureCount++
    }
  }

  Say ""
  Say "  done"
  Note "  可用命令: loom doctor, loom list"
  Note "  卸载: .\uninstall.ps1 -Tool <target>"
  Say ""

} finally {
  Cleanup-Temp
}

if ($failureCount -gt 0) { exit 1 }
