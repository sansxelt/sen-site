#!/usr/bin/env bash
# One-command desktop release. Builds the signed .exe, copies it into
# public/desktop/, patches the version strings + updater signature, and
# commits + pushes so Vercel redeploys the manifest.
#
# Prereqs (one-time on a new PC):
#   - Node 20+, Rust (rustup), VS Build Tools "Desktop dev with C++"
#   - VRAELIS-updater.key at repo root (copy from old PC — gitignored)
#   - env vars set in your shell:
#       export TAURI_SIGNING_PRIVATE_KEY="$(pwd)/VRAELIS-updater.key"
#       export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<the key password>'
#   - git remote set (check: git remote -v)
#
# Usage (from repo root):
#   bash scripts/ship-desktop.sh

set -euo pipefail

VERSION="0.1.15"
DATE_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DATE_LABEL="$(date -u '+%b %d, %Y')"
INSTALLER="VRAELIS_${VERSION}_x64-setup.exe"
BUNDLE="desktop/src-tauri/target/release/bundle/nsis/${INSTALLER}"
SIG_FILE="${BUNDLE}.sig"
PUBLIC_DEST="public/desktop/${INSTALLER}"
RELEASE_TS="lib/desktop-release.ts"
MANIFEST_TS="app/api/desktop/updates/latest/route.ts"

# --- sanity ---
[ -f "${RELEASE_TS}" ]  || { echo "run me from the repo root"; exit 1; }
[ -f "VRAELIS-updater.key" ] || { echo "VRAELIS-updater.key missing at repo root"; exit 1; }
: "${TAURI_SIGNING_PRIVATE_KEY:?set TAURI_SIGNING_PRIVATE_KEY first}"
: "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:?set TAURI_SIGNING_PRIVATE_KEY_PASSWORD first}"
git rev-parse --is-inside-work-tree > /dev/null || { echo "not a git repo"; exit 1; }

# --- step 1: build ---
echo "→ [1/5] building desktop v${VERSION} (npm install + tauri build)..."
( cd desktop && npm install && npm run tauri build )
[ -f "${BUNDLE}" ]   || { echo "installer not produced at ${BUNDLE}"; exit 1; }
[ -f "${SIG_FILE}" ] || { echo "signature not produced at ${SIG_FILE}"; exit 1; }

# --- step 2: copy .exe to public/desktop/ ---
echo "→ [2/5] copying installer to ${PUBLIC_DEST}..."
mkdir -p public/desktop
cp "${BUNDLE}" "${PUBLIC_DEST}"

# --- step 3: patch lib/desktop-release.ts ---
echo "→ [3/5] patching ${RELEASE_TS}..."
python - <<PY
import pathlib, re
p = pathlib.Path("${RELEASE_TS}")
s = p.read_text(encoding="utf-8")
patches = [
  (r'desktopLatestShippedVersion = "[^"]+"',     'desktopLatestShippedVersion = "${VERSION}"'),
  (r'desktopLatestShippedDateLabel = "[^"]+"',   'desktopLatestShippedDateLabel = "${DATE_LABEL}"'),
  (r'desktopLatestShippedDateIso = "[^"]+"',     'desktopLatestShippedDateIso = "${DATE_ISO}"'),
  (r'desktopWindowsInstallerPath = "[^"]+"',     'desktopWindowsInstallerPath = "/desktop/${INSTALLER}"'),
  (r'desktopWindowsInstallerFilename = "[^"]+"', 'desktopWindowsInstallerFilename = "${INSTALLER}"'),
]
for pat, new in patches:
  s, n = re.subn(pat, new, s, count=1)
  if n != 1:
    raise SystemExit(f"failed to patch pattern: {pat}")
p.write_text(s, encoding="utf-8")
PY

# --- step 4: patch signature in the updater manifest ---
echo "→ [4/5] patching signature in ${MANIFEST_TS}..."
python - <<PY
import pathlib, re
sig = pathlib.Path("${SIG_FILE}").read_text(encoding="utf-8").strip().replace("\n", "")
p = pathlib.Path("${MANIFEST_TS}")
s = p.read_text(encoding="utf-8")
# replace the windows-x86_64 signature: "..." block (first one in the file)
s, n = re.subn(r'signature:\s*"[^"]+"', f'signature: "{sig}"', s, count=1, flags=re.DOTALL)
if n != 1:
  raise SystemExit("failed to patch signature — manifest shape changed")
p.write_text(s, encoding="utf-8")
PY

# --- step 5: commit + push ---
echo "→ [5/5] commit + push..."
git add "${RELEASE_TS}" "${MANIFEST_TS}" "${PUBLIC_DEST}"
git commit -m "ship desktop v${VERSION}

Signed Windows installer + updater manifest published.
Existing 0.1.14 installs will prompt on next launch."
git push

echo ""
echo "✓ v${VERSION} pushed. Vercel will redeploy automatically."
echo "  Existing installs pick up the update on next launch."
