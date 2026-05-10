# loom — 卸载脚本（安全、可审计、可 dry-run）
#
# 本地模式：
#   .\uninstall.ps1 -Tool claude-code
#   .\uninstall.ps1 -Tool claude-code -DryRun
#
# Release 模式（从指定版本 tag 下载）：
#   .\uninstall.ps1 -Tool claude-code -FromRelease
#   .\uninstall.ps1 -Tool claude-code -FromRelease -Version 版本号

[CmdletBinding()]
param(
  [string[]]$Tool = @(),
  [string]$Version = "1.1.0",,
  [switch]$DryRun,
  [switch]$Purge,
  [switch]$FromRelease,
  [switch]$NoColor,
  [switch]$Help
)

$Repo = "xiqin/loom"
# TODO: replace hardcoded list — import from config/tools.schema.json via generate-tooling.mjs
$SupportedTools = @("claude-code", "cursor", "copilot", "opencode", "codex")

# ── Help ────────────────────────────────────────────────────────────────
if ($Help) {
@"
loom 卸载脚本

USAGE
  uninstall.ps1 -Tool <target> [flags]

FLAGS
  -Tool <target>      目标工具（必填，逗号分隔或重复指定）
                      支持：claude-code | cursor | copilot | opencode | codex
  -Version <ver>      指定版本（默认取脚本内嵌版本）
  -DryRun             预览删除文件，不实际执行
  -FromRelease        从 GitHub release tag 下载（可重现卸载）
                      默认：本地模式（需 clone 仓库）
  -Purge              额外清理：移除备份目录和 .gitignore 条目
  -NoColor            禁用颜色输出
  -Help               显示帮助信息

安全策略
  - 只删除 install-manifest.json 中记录的文件
  - 文件被用户修改后不会删除（输出 warning）
  -Purge 也不能越过 manifest 边界

示例
  .\uninstall.ps1 -Tool claude-code
  .\uninstall.ps1 -Tool claude-code -DryRun
  .\uninstall.ps1 -Tool claude-code -Purge
  .\uninstall.ps1 -Tool claude-code -FromRelease -Version 版本号
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

# ── Resolve version ─────────────────────────────────────────────────────
$InstallVersion = $Version

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
    if ((Test-Path (Join-Path $d "bin\loom.js")) -and (Test-Path (Join-Path $d "package.json"))) {
      return $d
    }
  }
  return $null
}

$RepoRoot = Get-RepoRoot

# ── Resolve loom source ───────────────────────────────────────────────────
$LoomCli = ""
$CleanupDir = ""
$Cleanup = $false

function Resolve-Source {
  if (-not $FromRelease -and $RepoRoot) {
    Note "  mode: local ($RepoRoot)"
    $script:LoomCli = Join-Path $RepoRoot "bin\loom.js"
    return
  }

  # Remote: download from release tag
  Note "  mode: release (v$InstallVersion)"

  $curlCmd = if (Get-Command "curl.exe" -ErrorAction SilentlyContinue) { "curl.exe" } else { "curl" }
  if (-not (Get-Command $curlCmd -ErrorAction SilentlyContinue)) {
    Err "error: curl is required for -FromRelease"
    exit 1
  }

  $script:CleanupDir = Join-Path $env:TEMP "loom-uninstall-$([Guid]::NewGuid())"
  New-Item -ItemType Directory -Path $CleanupDir -Force | Out-Null
  $script:Cleanup = $true

  $tarball = Join-Path $CleanupDir "loom.tar.gz"
  Say "  downloading loom v$InstallVersion from $Repo..."
  & $curlCmd -fsSL "https://github.com/$Repo/archive/refs/tags/v$InstallVersion.tar.gz" -o $tarball 2>$null
  if ($LASTEXITCODE -ne 0) {
    Err "error: download failed"
    exit 1
  }

  Note "  extracting..."
  if (Get-Command "tar.exe" -ErrorAction SilentlyContinue) {
    & tar.exe xzf $tarball -C $CleanupDir
  } elseif (Get-Command "tar" -ErrorAction SilentlyContinue) {
    & tar xzf $tarball -C $CleanupDir
  } else {
    Err "error: tar is required for extraction"
    exit 1
  }

  $extracted = Get-ChildItem -Path $CleanupDir -Directory | Select-Object -First 1
  if (-not $extracted -or -not (Test-Path (Join-Path $extracted.FullName "bin\loom.js"))) {
    Err "error: download appears incomplete — bin\loom.js not found"
    exit 1
  }

  Note "  installing dependencies..."
  Push-Location $extracted.FullName
  try {
    & npm install --production 2>$null
    if ($LASTEXITCODE -ne 0) { Warn "  warning: npm install failed, some features may not work" }
  } finally { Pop-Location }

  $script:LoomCli = Join-Path $extracted.FullName "bin\loom.js"
}

# ── Cleanup ─────────────────────────────────────────────────────────────
function Cleanup-Temp {
  if ($Cleanup -and $CleanupDir -and (Test-Path $CleanupDir)) {
    Remove-Item -Path $CleanupDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# ── Check Node.js ───────────────────────────────────────────────────────
function Check-Node {
  $node = Get-Command "node" -ErrorAction SilentlyContinue
  if (-not $node) {
    Err "error: Node.js is required (https://nodejs.org)"
    Err "  Install Node.js >= 18 and re-run"
    exit 1
  }
  $ver = & node -v
  $major = [int]($ver -replace 'v', '' -replace '\..*', '')
  if ($major -lt 18) {
    Err "error: Node.js >= 18 required (found: $ver)"
    exit 1
  }
}

# ── Main ────────────────────────────────────────────────────────────────
try {
  Say ""
  Say "  loom uninstall v$InstallVersion"
  Say "  $Repo"
  Say ""

  Check-Node
  Resolve-Source

  # Build CLI args
  $cliArgs = @("uninstall", "--version", $InstallVersion)
  if ($DryRun) { $cliArgs += "--dry-run" }
  if ($Purge)  { $cliArgs += "--purge" }

  foreach ($t in $Tools) {
    Say "→ $t"
    $fullArgs = $cliArgs + @("--tool", $t)

    Write-Host "  $ node $LoomCli $($fullArgs -join ' ')"
    try {
      & node $LoomCli @fullArgs
      if ($LASTEXITCODE -eq 0) {
        Ok "  ✔ $t 卸载完成"
      } else {
        Warn "  ✘ $t 卸载失败（可能未安装或 manifest 缺失）"
      }
    } catch {
      Warn "  ✘ $t 卸载失败: $($_.Exception.Message)"
    }
  }

  Say ""
  Say "  done"
  Note "  若需要重新安装: .\install.ps1 -Tool <target>"
  Say ""

} finally {
  Cleanup-Temp
}
