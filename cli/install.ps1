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

# ── WHAT TO DO NEXT, ALWAYS, NOT ONLY WHEN PATH HAPPENS TO BE RIGHT ───────────────────────────────────
#
# The next-steps block used to live in the on-PATH branch only. That branch is FALSE for every first-time
# install, because LOCALAPPDATAVraelis is on nobody's PATH by default, so the people who most needed
# telling were the only people never told. They got a PATH instruction and then silence.
#
# Numbered, because an installer that ends with three unlabelled commands leaves the reader to guess the
# order. Step 1 appears only when it is actually needed and the rest renumber around it.
$n = 1
function Step($text) { Write-Host ("  {0}. {1}" -f $script:n, $text); $script:n++ }

Write-Host "  Next:"
Write-Host ""

$onPath = ($env:Path -split ';') -contains $Dest
if (-not $onPath) {
  # This does NOT edit the registry. A piped installer that changes your environment is a surprise found
  # later by somebody who did not run it. The command is printed instead: user-scoped and reversible.
  Step "Put it on your PATH, for this window:"
  Write-Host ""
  Write-Host "       `$env:Path += `";$Dest`""
  Write-Host ""
  Write-Host "     To keep it, run this once and then open a NEW terminal:"
  Write-Host ""
  Write-Host "       [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path','User') + ';$Dest', 'User')"
  Write-Host ""
}

Step "Create an API key with `"Launch runs`" access:"
Write-Host ""
Write-Host "       https://app.vraelis.com/developers"
Write-Host ""
Step "Sign in. Paste the key when asked; it is hidden as you type."
Write-Host ""
Write-Host "       vraelis login"
Write-Host ""
# RIGHT-CLICK, because this is the one prompt where a failed paste looks like a failed key. The prompt
# hides what you type, so a Ctrl+V that inserts nothing is indistinguishable from a key that did not
# arrive — the reader tries again, gets the same silence, and concludes the login is broken. Ctrl+V does
# work in Windows Terminal and in recent conhost, but not in every window this script can be run from,
# and right-click works in all of them.
Write-Host "       Paste with a right-click. Ctrl+V does not work in every PowerShell window," -ForegroundColor DarkGray
Write-Host "       and because the prompt is hidden, a paste that did nothing looks like a bad key." -ForegroundColor DarkGray
Write-Host ""
Step "Verify something. This one spends credits:"
Write-Host ""
Write-Host "       vraelis verify --url https://your-preview.example.com ``"
Write-Host "         --claim `"A customer can upgrade and still have access after signing back in`" --wait"
Write-Host ""
Write-Host "  Exit codes: 0 verified, 1 failed, 2 blocked or could not run." -ForegroundColor DarkGray
Write-Host ""
