# loom — 卸载脚本（用户级卸载，可 dry-run）
#
# 本地模式：
#   .\uninstall.ps1 -Tool claude-code
#   .\uninstall.ps1 -Tool claude-code -DryRun
#
# Release 模式（从指定版本 tag 下载）：
#   .\uninstall.ps1 -Tool claude-code -FromRelease

[CmdletBinding()]
param(
  [string[]]$Tool = @(),
  [string]$Version,
  [switch]$DryRun,
  [switch]$FromRelease,
  [switch]$NoColor,
  [switch]$Help
)

$Repo = "xiqin/loom"
# AUTO-SYNC: updated by scripts/generate-tooling.mjs and scripts/sync-version.mjs
$DefaultVersion = "1.5.0"
if (-not $Version) { $Version = $DefaultVersion }
$SupportedTools = @("claude-code", "cursor", "copilot", "opencode", "codex")

# ── Help ────────────────────────────────────────────────────────────────
if ($Help) {
@"
loom 卸载脚本（用户级卸载）

USAGE
  uninstall.ps1 -Tool <target> [flags]

FLAGS
  -Tool <target>      目标工具（必填，逗号分隔或重复指定）
                       支持：claude-code | cursor | copilot | opencode | codex
  -DryRun             预览删除文件，不实际执行
  -FromRelease        从 GitHub release tag 下载（可重现卸载）
                       默认：本地模式（需 clone 仓库）
  -Version <ver>      指定下载版本（需配合 -FromRelease 使用）
  -NoColor            禁用颜色输出
  -Help               显示帮助信息

示例
  .\uninstall.ps1 -Tool claude-code
  .\uninstall.ps1 -Tool claude-code -DryRun
  .\uninstall.ps1 -Tool claude-code -FromRelease -Version 1.0.0
"@
  exit 0
}

# ── Color helpers ───────────────────────────────────────────────────────
$Esc = [char]27
function Say($msg)   { if ($NoColor) { Write-Host $msg } else { Write-Host "$Esc[38;5;39m$msg$Esc[0m" } }
function Note($msg)  { if ($NoColor) { Write-Host $msg } else { Write-Host "$Esc[2m$msg$Esc[0m" } }
function Ok($msg)    { if ($NoColor) { Write-Host $msg } else { Write-Host "$Esc[32m$msg$Esc[0m" } }
function Warn($msg)  { if ($NoColor) { Write-Host $msg } else { Write-Host "$Esc[33m$msg$Esc[0m" } }
function Err($msg)   { if ($NoColor) { [Console]::Error.WriteLine($msg) } else { [Console]::Error.WriteLine("$Esc[31m$msg$Esc[0m") } }

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
  Note "  mode: release (v$Version)"

  $curlCmd = $null
  if (Get-Command "curl.exe" -ErrorAction SilentlyContinue) {
    $curlCmd = "curl.exe"
  } elseif (Get-Command "curl" -ErrorAction SilentlyContinue) {
    $curlPath = (Get-Command "curl" -ErrorAction SilentlyContinue).Source
    if ($curlPath -and -not $curlPath.EndsWith("\WindowsPowerShell\v1.0\curl.exe", [StringComparison]::OrdinalIgnoreCase)) {
      $curlCmd = "curl"
    }
  }
  if (-not $curlCmd) {
    Err "error: curl is required for -FromRelease"
    exit 1
  }

  $script:CleanupDir = Join-Path $env:TEMP "loom-uninstall-$([Guid]::NewGuid())"
  New-Item -ItemType Directory -Path $CleanupDir -Force | Out-Null
  $script:Cleanup = $true

  $tarball = Join-Path $CleanupDir "loom.tar.gz"
  Say "  downloading loom v$Version from $Repo..."
  & $curlCmd -fsSL "https://github.com/$Repo/archive/refs/tags/v$Version.tar.gz" -o $tarball 2>$null
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
  if ($LASTEXITCODE -ne 0) {
    Err "error: extraction failed"
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
  Say "  loom uninstall v$Version"
  Say "  $Repo"
  Say ""

  Check-Node
  Resolve-Source

  # Build CLI args
  $cliArgs = @("uninstall")
  if ($DryRun) { $cliArgs += "--dry-run" }

  $failureCount = 0

  foreach ($t in $Tools) {
    Say "→ $t"
    $fullArgs = $cliArgs + @("--tool", $t)

    Write-Host "  $ node $LoomCli $($fullArgs -join ' ')"
    try {
      & node $LoomCli @fullArgs
      if ($LASTEXITCODE -eq 0) {
        Ok "  ✔ $t 卸载完成"
      } else {
        Warn "  ✘ $t 卸载失败"
        $failureCount++
      }
    } catch {
      Warn "  ✘ $t 卸载失败: $($_.Exception.Message)"
      $failureCount++
    }
  }

  Say ""
  Say "  done"
  Note "  若需要重新安装: .\install.ps1 -Tool <target>"
  Say ""

} finally {
  Cleanup-Temp
}

if ($failureCount -gt 0) { exit 1 }
