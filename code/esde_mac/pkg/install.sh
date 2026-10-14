#!/bin/bash
# Browser Arcade -> ES-DE installer for macOS.
# Copies the app, the "browsergames" system, gamelist and media into the ES-DE folders,
# removes the download quarantine, and merges (never overwrites) an existing custom es_systems.xml.
# Overrides: ESDE_DIR (default ~/ES-DE), ROMS_DIR, MEDIA_DIR, APP_DIR (default ~/Applications)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SYS=browsergames
STAMP="$(date +%Y%m%d-%H%M%S)"
ESDE_DIR="${ESDE_DIR:-$HOME/ES-DE}"
APP_DIR="${APP_DIR:-$HOME/Applications}"
SETTINGS="$ESDE_DIR/settings/es_settings.xml"

say() { printf '\033[1m==>\033[0m %s\n' "$*"; }
setting() { # read <string name="$1" value="..."/> from es_settings.xml
  [ -f "$SETTINGS" ] || return 0
  sed -n "s/.*<string name=\"$1\" value=\"\([^\"]*\)\".*/\1/p" "$SETTINGS" | head -n1
}
expand() { local p="$1"; p="${p/#\~/$HOME}"; printf '%s' "$p"; }

[ "$(uname -s)" = "Darwin" ] || { echo "This installer is for macOS."; exit 1; }
if pgrep -xq ES-DE; then echo "Please quit ES-DE first (it rewrites its files on exit), then run this again."; exit 1; fi

# ---- where things go ----
if [ -z "${ROMS_DIR:-}" ]; then
  r="$(setting ROMDirectory)"
  if [ -n "$r" ] && [[ "$r" != *%ESPATH%* ]]; then ROMS_DIR="$(expand "$r")"; else ROMS_DIR="$HOME/ROMs"; fi
fi
if [ -z "${MEDIA_DIR:-}" ]; then
  m="$(setting MediaDirectory)"
  if [ -n "$m" ] && [[ "$m" != *%ESPATH%* ]]; then MEDIA_DIR="$(expand "$m")"; else MEDIA_DIR="$ESDE_DIR/downloaded_media"; fi
fi
say "ES-DE folder:   $ESDE_DIR"
say "ROMs folder:    $ROMS_DIR"
say "Media folder:   $MEDIA_DIR"
say "App folder:     $APP_DIR"

# ---- 1. the app (pick the build for this Mac's CPU, even under Rosetta) ----
if [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ]; then ARCH=arm64; else ARCH=x64; fi
SRC_APP="$HERE/apps/$ARCH/Browser Arcade.app"
[ -d "$SRC_APP" ] || { echo "Missing $SRC_APP"; exit 1; }
mkdir -p "$APP_DIR"
DST_APP="$APP_DIR/Browser Arcade.app"
if [ -d "$DST_APP" ]; then say "Replacing existing $DST_APP (your saves are kept, they live in ~/Library/Application Support/Browser Arcade)"; rm -rf "$DST_APP"; fi
say "Installing Browser Arcade ($ARCH) -> $DST_APP"
ditto "$SRC_APP" "$DST_APP"
# Unsigned app: remove the download quarantine so Gatekeeper doesn't block it.
xattr -cr "$DST_APP" 2>/dev/null || true
# The bundle ships ad-hoc signed; if the signature doesn't verify on this Mac, re-sign it ad-hoc locally.
if ! codesign --verify --deep "$DST_APP" >/dev/null 2>&1; then
  say "Re-signing the app ad-hoc (local, no Apple ID needed)"
  codesign --force --deep --sign - "$DST_APP" >/dev/null 2>&1 || echo "   (codesign failed; use right-click > Open once, see README)"
fi

# ---- 2. ROM launchers ----
mkdir -p "$ROMS_DIR/$SYS"
for f in "$HERE/roms/$SYS/"*.sh; do cp -f "$f" "$ROMS_DIR/$SYS/"; chmod +x "$ROMS_DIR/$SYS/$(basename "$f")"; done
xattr -cr "$ROMS_DIR/$SYS" 2>/dev/null || true
say "ROM launchers -> $ROMS_DIR/$SYS"

# ---- 3. custom es_systems.xml (merge) ----
CS_DIR="$ESDE_DIR/custom_systems"; CS="$CS_DIR/es_systems.xml"; mkdir -p "$CS_DIR"
BLOCK="$(sed -n '/<system>/,/<\/system>/p' "$HERE/custom_systems/es_systems.xml")"
if [ -f "$CS" ]; then
  cp -p "$CS" "$CS.backup-$STAMP"
  say "Backed up existing custom systems file -> $CS.backup-$STAMP"
  TMP="$(mktemp)"
  # drop any previous browsergames <system> block, then insert ours before </systemList>
  BF="$(mktemp)"; printf '%s\n' "$BLOCK" > "$BF"
  awk -v bf="$BF" '
    BEGIN { while ((getline l < bf) > 0) block = block l "\n" }
    /<system>/ && !insys { insys=1; buf=$0 "\n"; keep=1; next }
    insys { buf = buf $0 "\n"; if ($0 ~ /<name>[ \t]*browsergames[ \t]*<\/name>/) keep=0;
            if ($0 ~ /<\/system>/) { if (keep) printf "%s", buf; insys=0; buf="" } next }
    /<\/systemList>/ && !done { printf "%s", block; done=1 }
    { print }
    END { if (!done) { print "<systemList>"; printf "%s", block; print "</systemList>" } }
  ' "$CS" > "$TMP"; rm -f "$BF"
  if grep -q "<name>$SYS</name>" "$TMP" && grep -q "</systemList>" "$TMP"; then mv "$TMP" "$CS"; say "Merged the Browser Arcade system into $CS"
  else rm -f "$TMP"; echo "Could not merge automatically; your file is untouched. Add the <system> block from custom_systems/es_systems.xml by hand."; fi
else
  cp "$HERE/custom_systems/es_systems.xml" "$CS"; say "Created $CS"
fi

# ---- 4. gamelist ----
GL_DIR="$ESDE_DIR/gamelists/$SYS"; mkdir -p "$GL_DIR"
[ -f "$GL_DIR/gamelist.xml" ] && cp -p "$GL_DIR/gamelist.xml" "$GL_DIR/gamelist.xml.backup-$STAMP"
cp -f "$HERE/gamelists/$SYS/gamelist.xml" "$GL_DIR/gamelist.xml"
say "Gamelist -> $GL_DIR/gamelist.xml"

# ---- 5. media ----
mkdir -p "$MEDIA_DIR/$SYS"
ditto "$HERE/downloaded_media/$SYS" "$MEDIA_DIR/$SYS"
xattr -cr "$MEDIA_DIR/$SYS" 2>/dev/null || true
say "Media -> $MEDIA_DIR/$SYS"

echo
say "Done. Start ES-DE: the 'Browser Arcade' system lists both games."
echo "    In a game: hold Select+Start (Back+Start) or Esc for 1 second to return to ES-DE."
