# Vraelis CLI installer for Windows.  irm https://vraelis.com/install.ps1 | iex
#
# The sh installer does not run here. `sh` is not on PATH in cmd.exe or PowerShell, so
# `curl ... | sh` fails with "sh is not recognized" for every Windows developer who follows the docs.
# Git Bash has it; a plain terminal does not, and the docs cannot assume which one someone opened.
#
# WINDOWS POWERSHELL 5.1 IS THE TARGET, not PowerShell 7. 5.1 is what ships with Windows and is what most
# machines still run, so there is no ternary, no null-coalescing, and no PowerShell Core cmdlet in here.
# Anything newer runs this fine; the reverse is not true.
#
# NO ADMIN. It writes to LOCALAPPDATA, which is the user's own directory. An installer that asks to elevate
# in order to place two files is asking for far more trust than the job needs, and on a locked-down work
# machine or a CI runner it is trust nobody can grant.

$ErrorActionPreference = "Stop"

$Base    = if ($env:VRAELIS_BASE) { $env:VRAELIS_BASE } else { "https://vraelis.com" }
$Dest    = if ($env:VRAELIS_INSTALL_DIR) { $env:VRAELIS_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "Vraelis" }
$MinNode = 18

function Fail($msg) { Write-Host ""; Write-Host "vraelis: $msg" -ForegroundColor Red; exit 1 }

# ── Node, and the version, because otherwise the failure arrives as a syntax error ─────────────────────
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Fail "Node $MinNode or newer is required, and node was not found on PATH.`n       Install it from https://nodejs.org and run this again."
}
$major = 0
try { $major = [int](& node -p "process.versions.node.split('.')[0]") } catch { $major = 0 }
if ($major -lt $MinNode) {
  Fail "Node $MinNode or newer is required. Found $(& node -v).`n       The CLI uses fetch and top-level await, so an older Node fails with a syntax error rather than a useful message."
}

# ── Download ───────────────────────────────────────────────────────────────────────────────────────────
# TLS 1.2 explicitly: Windows PowerShell 5.1 still defaults to SSL3/TLS1.0 on some builds, and the
# download then fails with a connection error that says nothing about why.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$tmp = Join-Path $Dest "vraelis.mjs.download"
try {
  # -UseBasicParsing because 5.1 otherwise wants Internet Explorer's engine, which is absent on Server core
  # and on any machine where IE has been removed.
  Invoke-WebRequest -Uri "$Base/cli/vraelis.mjs" -OutFile $tmp -UseBasicParsing
} catch {
  Fail "download failed from $Base/cli/vraelis.mjs`n       $($_.Exception.Message)"
}

# A truncated or intercepted download is usually still a valid file, just the wrong one. A captive portal's
# login page is about this size and would install perfectly cleanly, then fail at the worst moment.
if (-not (Test-Path $tmp) -or (Get-Item $tmp).Length -lt 1024) { Remove-Item $tmp -Force -EA SilentlyContinue; Fail "the downloaded file was empty or truncated" }
if (-not (Select-String -Path $tmp -Pattern "vraelis" -Quiet)) {
  Remove-Item $tmp -Force -EA SilentlyContinue
  Fail "the downloaded file does not look like the Vraelis CLI.`n       This usually means a proxy or captive portal answered instead of $Base."
}

Move-Item -Path $tmp -Destination (Join-Path $Dest "vraelis.mjs") -Force

# ── The command ────────────────────────────────────────────────────────────────────────────────────────
# A .cmd shim rather than a .ps1 one. .cmd is on PATHEXT, so `vraelis` works from cmd.exe, from PowerShell,
# from a CI step and from anything that shells out. A .ps1 would only work in PowerShell, and only once the
# machine's execution policy allowed it, which is the kind of thing that turns an install into a support
# thread.
$shim = Join-Path $Dest "vraelis.cmd"
"@echo off`r`nnode `"%~dp0vraelis.mjs`" %*" | Set-Content -Path $shim -Encoding ASCII

Write-Host ""
Write-Host "  Vraelis CLI installed." -ForegroundColor Green
Write-Host "    $shim"
Write-Host ""

# ── PATH, said rather than silently rewritten ──────────────────────────────────────────────────────────
# This does NOT edit the registry. A piped installer that changes your environment is a surprise found
# later by someone who did not run it, and the same restraint the sh installer shows about shell profiles
# applies here. The command to make it permanent is printed instead, and it is user-scoped and reversible.
$onPath = ($env:Path -split ';') -contains $Dest
if ($onPath) {
  Write-Host "  Get a key at https://app.vraelis.com/developers, then:"
  Write-Host ""
  Write-Host "    vraelis login"
  Write-Host "    vraelis verify --url https://your-preview.example.com --claim `"...`" --wait"
} else {
  Write-Host "  $Dest is not on your PATH. For this session:"
  Write-Host ""
  Write-Host "    `$env:Path += `";$Dest`""
  Write-Host ""
  Write-Host "  To keep it, once:"
  Write-Host ""
  Write-Host "    [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path','User') + ';$Dest', 'User')"
  Write-Host ""
  Write-Host "  This installer does not change your PATH for you." -ForegroundColor DarkGray
}
Write-Host ""
