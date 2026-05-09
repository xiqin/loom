# rss — 一键卸载脚本 (Windows PowerShell)
#
# 使用方式：
#   # 本地模式（从 clone 的仓库运行）
#   .\uninstall.ps1 -Tool claude-code
#   .\uninstall.ps1 -Tool claude-code,cursor -Purge
#
#   # 远程模式（irm 一键卸载）
#   irm https://raw.githubusercontent.com/xiqin/rss/main/uninstall.ps1 | iex -Tool claude-code

[CmdletBinding()]
param(
  [string[]]$Tool = @(),
  [switch]$Purge,
  [switch]$DryRun,
  [switch]$NoColor,
  [switch]$Help
)

$Repo = "xiqin/rss"
$RawBase = "https://raw.githubusercontent.com/$Repo/main"
$Version = "1.0.0"
$SupportedTools = @("claude-code", "cursor", "copilot", "opencode", "codex")

# ── Help ────────────────────────────────────────────────────────────────
if ($Help) {
@"
rss 一键卸载脚本 (Windows)

USAGE
  uninstall.ps1 [flags]

  本地模式（仓库内）：
    .\uninstall.ps1 -Tool claude-code

  远程模式（irm 管道）：
    irm $RawBase/uninstall.ps1 | iex -Tool claude-code

FLAGS
  -Tool <target>    目标工具（必填，逗号分隔）
                    支持：claude-code | cursor | copilot | opencode | codex
  -Purge            额外清理：移除全局 rss CLI、删除 .rss-backup/ 备份目录
  -DryRun           预览，不实际执行
  -NoColor          禁用颜色输出
  -Help             显示帮助信息

示例
  .\uninstall.ps1 -Tool claude-code                       # 卸载 Claude Code
  .\uninstall.ps1 -Tool claude-code,cursor -Purge         # 卸载两个工具 + 清理全局 CLI
"@
  exit 0
}

# ── Color helpers ───────────────────────────────────────────────────────
$Esc = [char]27
function Say($msg)   { if ($NoColor) { Write-Host $msg } else { Write-Host "$Esc[38;5;39m$msg$Esc[0m" } }
function Note($msg)  { if ($NoColor) { Write-Host $msg } else { Write-Host "$Esc[2m$msg$Esc[0m" } }
function Ok($msg)    { if ($NoColor) { Write-Host $msg } else { Write-Host "$Esc[32m$msg$Esc[0m" } }
function Warn($msg)  { if ($NoColor) { Write-Host $msg } else { Write-Host "$Esc[33m$msg$Esc[0m" } }
function Err($msg)   { if ($NoColor) { Write-Host $msg } else { Write-Host "$Esc[31m$msg$Esc[0m" } }

# ── Validate tool ───────────────────────────────────────────────────────
$Tools = @()
foreach ($t in $Tool) {
  foreach ($x in ($t -split ',')) {
    $trimmed = $x.Trim()
    if ($trimmed) {
      if ($SupportedTools -notcontains $trimmed) {
        Err "error: unsupported tool '$trimmed'. Supported: $($SupportedTools -join ', ')"
        exit 2
      }
      $Tools += $trimmed
    }
  }
}

if ($Tools.Count -eq 0) {
  Err "error: -Tool is required"
  Write-Host "  Supported: $($SupportedTools -join ', ')"
  Write-Host "  Example: .\uninstall.ps1 -Tool claude-code"
  exit 2
}

# ── Detect repo root ────────────────────────────────────────────────────
function Get-RepoRoot {
  $src = $PSCommandPath
  if ($src -and (Test-Path $src)) {
    $d = Split-Path -Parent $src
    if ((Test-Path (Join-Path $d "bin\rss.js")) -and (Test-Path (Join-Path $d "package.json"))) {
      return $d
    }
  }
  return $null
}

# ── Try-Run helper ──────────────────────────────────────────────────────
function Try-Run {
  param([string]$Exe, [string[]]$Argv)
  if ($DryRun) {
    Note "  would run: $Exe $($Argv -join ' ')"
    return $true
  }
  Write-Host "  $ $Exe $($Argv -join ' ')"
  try {
    & $Exe @Argv
    return ($LASTEXITCODE -eq 0)
  } catch {
    Warn "  $($_.Exception.Message)"
    return $false
  }
}

# ── Resolve RSS source ──────────────────────────────────────────────────
$RssCli = ""
$CleanupDir = ""
$Cleanup = $false
$RepoRoot = Get-RepoRoot

function Resolve-Source {
  # First try: globally installed rss CLI
  $globalRss = Get-Command "rss" -ErrorAction SilentlyContinue
  if ($globalRss) {
    $script:RssCli = "rss"
    Note "  mode: global CLI"
    return
  }

  # Second try: local repo clone
  if ($RepoRoot) {
    $script:RssCli = Join-Path $RepoRoot "bin\rss.js"
    Note "  mode: local ($RepoRoot)"
    return
  }

  # Third try: download remote
  Note "  mode: remote (irm-pipe)"
  $curlCmd = if (Get-Command "curl.exe" -ErrorAction SilentlyContinue) { "curl.exe" } else { "curl" }
  if (-not (Get-Command $curlCmd -ErrorAction SilentlyContinue)) {
    Err "error: curl is required for remote uninstall"
    exit 1
  }

  $script:CleanupDir = Join-Path $env:TEMP "rss-uninstall-$([Guid]::NewGuid())"
  New-Item -ItemType Directory -Path $CleanupDir -Force | Out-Null
  $script:Cleanup = $true

  $tarball = Join-Path $CleanupDir "rss.tar.gz"
  Say "  downloading rss from $Repo..."
  & $curlCmd -fsSL "https://github.com/$Repo/archive/main.tar.gz" -o $tarball 2>$null

  if (Get-Command "tar.exe" -ErrorAction SilentlyContinue) {
    & tar.exe xzf $tarball -C $CleanupDir
  } else {
    Err "error: tar.exe is required (available in Windows 10 1803+)"
    exit 1
  }

  $extracted = Get-ChildItem -Path $CleanupDir -Directory | Select-Object -First 1
  if (-not $extracted -or -not (Test-Path (Join-Path $extracted.FullName "bin\rss.js"))) {
    Err "error: download appears incomplete"
    exit 1
  }

  $script:RssCli = Join-Path $extracted.FullName "bin\rss.js"
}

function Cleanup-Temp {
  if ($Cleanup -and $CleanupDir -and (Test-Path $CleanupDir)) {
    Remove-Item -Path $CleanupDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# ── Main ────────────────────────────────────────────────────────────────
try {
  Say ""
  Say "  rss uninstall v$Version"
  Say "  $Repo"
  Say ""

  Resolve-Source

  $cliArgs = @($RssCli, "uninstall")
  if ($DryRun) { $cliArgs += "--dry-run" }

  foreach ($tool in $Tools) {
    Say "→ $tool"
    $fullArgs = $cliArgs + @("--tool", $tool)

    if (Try-Run "node" $fullArgs) {
      Ok "  ✔ $tool 卸载完成"
    } else {
      Warn "  ✘ $tool 卸载失败（项目目录中可能未安装 rss）"
      Note "  请确认在目标项目的根目录运行此脚本"
    }
  }

  # --Purge: additional cleanup
  if ($Purge) {
    Say "→ 清理全局残留"

    # Remove global rss CLI
    $globalRss = Get-Command "rss" -ErrorAction SilentlyContinue
    if ($globalRss) {
      if ($DryRun) {
        Note "  would run: npm uninstall -g rss-engineering"
      } else {
        Try-Run "npm" @("uninstall", "-g", "rss-engineering") | Out-Null
        Try-Run "npm" @("uninstall", "-g", "rss") | Out-Null
        Ok "  ✔ 全局 rss CLI 已移除"
      }
    }

    # Remove npm link if from local clone
    if ($RepoRoot -and (Test-Path (Join-Path $RepoRoot "package.json"))) {
      $pkgName = & node -e "console.log(require('$([string]$RepoRoot -replace '\\', '\\\\')/package.json').name || '')" 2>$null
      if ($pkgName) {
        if ($DryRun) {
          Note "  would run: npm unlink -g $pkgName"
        } else {
          Try-Run "npm" @("unlink", "-g", $pkgName) | Out-Null
        }
      }
    }

    # Remove .rss-backup directory
    $backupDir = Join-Path (Get-Location) ".rss-backup"
    if (Test-Path $backupDir) {
      if ($DryRun) {
        Note "  would remove: $backupDir"
      } else {
        Remove-Item -Path $backupDir -Recurse -Force -ErrorAction SilentlyContinue
        Ok "  ✔ .rss-backup/ 已删除"
      }
    }

    # Clean .gitignore entries
    $gitignore = Join-Path (Get-Location) ".gitignore"
    if (Test-Path $gitignore) {
      if ($DryRun) {
        Note "  would clean .gitignore rss entries"
      } else {
        $content = Get-Content $gitignore -Raw
        $content = $content -replace '# rss-engineering\n', ''
        $content = $content -replace '\.rss-backup/\n', ''
        Set-Content -Path $gitignore -Value $content -NoNewline
        Ok "  ✔ .gitignore rss 条目已清理"
      }
    }
  }

  Say ""
  Say "  done"
  Note "  若需要重新安装: .\install.ps1 -Tool <target>"
  Say ""

} finally {
  Cleanup-Temp
}
