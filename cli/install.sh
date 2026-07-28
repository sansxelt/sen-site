#!/bin/sh
# Vraelis CLI installer.  curl -fsS https://vraelis.com/install | sh
#
# Installs a `vraelis` command, so verifying a deployment is one word rather than a path to a file the
# customer had to find first. Before this, the docs said `node ./cli/vraelis.mjs`, a path inside our own
# repository, and the honest version of that instruction did not exist.
#
# POSIX sh, not bash. macOS still ships bash 3.2 and plenty of CI images have no bash at all; the whole
# point of an installer is that it runs on the machine you did not choose.
#
# NO SUDO, EVER. It installs to ~/.local/bin, which is the user's own directory. An installer that asks for
# root to drop one text file is asking for a great deal more trust than the job needs, and a CI runner
# usually cannot give it anyway.
#
# set -e, and every failure says what to do. A partially installed CLI that half works is worse than a
# clear refusal, because the failure surfaces later, inside someone's deploy pipeline.
set -eu

BASE="${VRAELIS_BASE:-https://vraelis.com}"
DEST="${VRAELIS_INSTALL_DIR:-$HOME/.local/bin}"
LIB="${VRAELIS_LIB_DIR:-$HOME/.vraelis}"
MIN_NODE=18

say()  { printf '%s\n' "$*"; }
die()  { printf 'vraelis: %s\n' "$*" >&2; exit 1; }

# ── Node, and the version, because the failure otherwise arrives as a syntax error ────────────────────
command -v node >/dev/null 2>&1 || die "Node $MIN_NODE or newer is required, and node was not found on PATH.
       Install Node from https://nodejs.org and run this again."

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt "$MIN_NODE" ] 2>/dev/null; then
  die "Node $MIN_NODE or newer is required. Found $(node -v).
       The CLI uses fetch and top-level await, so an older Node fails with a syntax error rather than a
       useful message, which is why this checks first."
fi

# ── Download ──────────────────────────────────────────────────────────────────────────────────────────
# To a temp file, then moved into place. Writing straight to the destination means an interrupted download
# leaves a truncated CLI that runs and does the wrong thing.
mkdir -p "$LIB" "$DEST"
TMP=$(mktemp "${TMPDIR:-/tmp}/vraelis.XXXXXX") || die "could not create a temporary file"
trap 'rm -f "$TMP"' EXIT INT TERM

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$BASE/cli/vraelis.mjs" -o "$TMP" || die "download failed from $BASE/cli/vraelis.mjs"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TMP" "$BASE/cli/vraelis.mjs" || die "download failed from $BASE/cli/vraelis.mjs"
else
  die "neither curl nor wget is available"
fi

# A truncated or redirected download is usually still a valid file, just the wrong one. A login page is
# about this size and would install cleanly and then fail at the worst moment.
[ -s "$TMP" ] || die "the downloaded file was empty"
head -n 40 "$TMP" | grep -q "vraelis" || die "the downloaded file does not look like the Vraelis CLI.
       This usually means a proxy or captive portal answered instead of $BASE."

mv "$TMP" "$LIB/vraelis.mjs"
trap - EXIT INT TERM
chmod 0644 "$LIB/vraelis.mjs"

# ── The command itself ────────────────────────────────────────────────────────────────────────────────
# A shim rather than a symlink to the .mjs: the file needs `node` in front of it, and a symlink would rely
# on the shebang plus an executable bit surviving the download, which it does not.
cat > "$DEST/vraelis" <<SHIM
#!/bin/sh
exec node "$LIB/vraelis.mjs" "\$@"
SHIM
chmod 0755 "$DEST/vraelis"

say ""
say "  Vraelis CLI installed."
say "    $DEST/vraelis"
say ""

# ── PATH, said plainly rather than edited silently ────────────────────────────────────────────────────
# This does NOT write to a shell profile. Editing someone's .zshrc from a piped script is a surprise, and
# the surprise is discovered later by someone who did not run this. Telling them is enough.
case ":${PATH}:" in
  *":$DEST:"*)
    say "  Get a key at https://app.vraelis.com/developers, then:"
    say ""
    say "    export VRAELIS_API_KEY=vr_live_..."
    say "    vraelis verify --url https://your-preview.example.com \\"
    say "      --claim \"A customer can upgrade and still have access after signing back in\" --wait"
    ;;
  *)
    say "  $DEST is not on your PATH. Add it:"
    say ""
    say "    export PATH=\"$DEST:\$PATH\""
    say ""
    say "  Add that line to your shell profile to keep it. This installer does not edit profiles."
    ;;
esac
say ""
