# rss — 一键安装脚本 (Windows PowerShell)
#
# 使用方式：
#   # 本地模式（从 clone 的仓库运行）
#   .\install.ps1 -Tool claude-code
#   .\install.ps1 -Tool claude-code, cursor -Link
#
#   # 远程模式（irm 一键安装）
#   irm https://raw.githubusercontent.com/xiqin/rss/main/install.ps1 | iex -Tool claude-code
#
# 支持的工具：claude-code | cursor | copilot | opencode | codex

[CmdletBinding()]
param(
  [string[]]$Tool = @(),
  [switch]$Force,
  [switch]$Link,
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
rss 一键安装脚本 (Windows)

USAGE
  install.ps1 [flags]

  本地模式（仓库内）：
    .\install.ps1 -Tool claude-code

  远程模式（irm 管道）：
    irm $RawBase/install.ps1 | iex -Tool claude-code

FLAGS
  -Tool <target>    目标工具（必填，逗号分隔或重复指定）
                    支持：claude-code | cursor | copilot | opencode | codex
                    例：-Tool claude-code,cursor
  -Force            覆盖已有文件（自动备份）
  -Link             将 rss CLI 注册到全局（npm link）
  -DryRun           预览，不实际写入
  -NoColor          禁用颜色输出
  -Help             显示帮助信息

示例
  .\install.ps1 -Tool claude-code                        # 安装到 Claude Code
  .\install.ps1 -Tool claude-code,cursor -Link           # 安装到两个工具 + 全局 CLI
  .\install.ps1 -Tool opencode -Force                    # 强制覆盖安装到 OpenCode
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
  Write-Host "  Example: .\install.ps1 -Tool claude-code"
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

$RepoRoot = Get-RepoRoot

# ── Resolve RSS source ──────────────────────────────────────────────────
$RssCli = ""
$CleanupDir = ""
$Cleanup = $false

function Resolve-Source {
  if ($RepoRoot) {
    Note "  mode: local ($RepoRoot)"
    $script:RssCli = Join-Path $RepoRoot "bin\rss.js"
    return
  }

  Note "  mode: remote (irm-pipe)"
  if (-not (Get-Command "curl.exe" -ErrorAction SilentlyContinue) -and -not (Get-Command "curl" -ErrorAction SilentlyContinue)) {
    Err "error: curl is required for remote install on Windows"
    exit 1
  }

  $script:CleanupDir = Join-Path $env:TEMP "rss-install-$([Guid]::NewGuid())"
  New-Item -ItemType Directory -Path $CleanupDir -Force | Out-Null
  $script:Cleanup = $true

  $tarball = Join-Path $CleanupDir "rss.tar.gz"
  Say "  downloading rss from $Repo..."

  # Prefer curl.exe on Windows for better binary download
  $curlCmd = if (Get-Command "curl.exe" -ErrorAction SilentlyContinue) { "curl.exe" } else { "curl" }
  & $curlCmd -fsSL "https://github.com/$Repo/archive/main.tar.gz" -o $tarball 2>$null
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
    # Fallback: use PowerShell's System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $gzStream = [System.IO.File]::OpenRead($tarball)
    $gzip = New-Object System.IO.Compression.GZipStream($gzStream, [System.IO.Compression.CompressionMode]::Decompress)
    $tarStream = New-Object System.IO.MemoryStream
    $gzip.CopyTo($tarStream)
    $tarStream.Position = 0
    $gzip.Dispose()
    $gzStream.Dispose()
    # This extracts but we'd need a tar parser - fallback
    Err "error: tar is required for extraction"
    exit 1
  }

  # Find extracted directory
  $extracted = Get-ChildItem -Path $CleanupDir -Directory | Select-Object -First 1
  if (-not $extracted -or -not (Test-Path (Join-Path $extracted.FullName "bin\rss.js"))) {
    Err "error: download appears incomplete — bin\rss.js not found"
    exit 1
  }

  Note "  installing dependencies..."
  Push-Location $extracted.FullName
  try {
    & npm install --production 2>$null
    if ($LASTEXITCODE -ne 0) { Warn "  warning: npm install failed, some features may not work" }
  } finally { Pop-Location }

  $script:RssCli = Join-Path $extracted.FullName "bin\rss.js"
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

# ── Main ────────────────────────────────────────────────────────────────
try {
  Say ""
  Say "  rss install v$Version"
  Say "  $Repo"
  Say ""

  Check-Node
  Resolve-Source

  $cliArgs = @($RssCli, "init")
  if ($DryRun) { $cliArgs += "--dry-run" }

  foreach ($tool in $Tools) {
    Say "→ $tool"
    $fullArgs = $cliArgs + @("--tool", $tool)
    if ($Force) { $fullArgs += "--force" }

    if (Try-Run "node" $fullArgs) {
      Ok "  ✔ $tool 安装完成"
    } else {
      Warn "  ✘ $tool 安装失败"
    }
  }

  # Optional: npm link for global CLI
  if ($Link -and $RepoRoot) {
    Note "  registering rss CLI globally (npm link)..."
    if ($DryRun) {
      Note "  would run: npm link in $RepoRoot"
    } else {
      Push-Location $RepoRoot
      try {
        if (Try-Run "npm" @("link")) {
          Ok "  ✔ rss CLI 已注册到全局，运行 'rss --help' 验证"
        }
      } finally { Pop-Location }
    }
  } elseif ($Link -and -not $RepoRoot) {
    Warn "  --link 仅在本地模式有效（远程模式下载到临时目录）"
    Warn "  安装后手动进入项目目录运行 'npm link'"
  }

  Say ""
  Say "  done"
  Note "  可用命令: rss doctor, rss list, rss update"
  if (-not $Link) {
    Note "  要在项目中使用 rss CLI，运行: node $RssCli <command>"
    Note "  或通过 -Link 注册到全局"
  }
  $uninstallPath = Join-Path (Split-Path $RssCli -Parent) "..\uninstall.ps1"
  Note "  卸载: $uninstallPath -Tool <target>"
  Say ""

} finally {
  Cleanup-Temp
}
