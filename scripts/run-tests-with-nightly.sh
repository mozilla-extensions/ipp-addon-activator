#!/usr/bin/env bash
set -Eeuo pipefail

# This script ensures FIREFOX_BINARY is set. If not, it downloads
# Firefox Nightly for Linux x64 into .cache and uses it to run tests.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_ROOT="$ROOT_DIR/.cache"
CACHE_DIR="$CACHE_ROOT/firefox-nightly-linux64"
ARCHIVE_PATH="$CACHE_DIR/firefox-nightly.tar.bz2"
FIREFOX_BIN="$CACHE_DIR/firefox/firefox"

log() { echo "[test-setup] $*"; }

run_mocha() {
  export FIREFOX_BINARY
  export FIREFOX_HEADLESS=1
  log "Running Firefox in headless mode"
  node "$ROOT_DIR/node_modules/mocha/bin/mocha.js" --timeout 120000 "test/*.mocha.test.js"
}

if [[ -n "${FIREFOX_BINARY:-}" && -x "${FIREFOX_BINARY}" ]]; then
  log "Using FIREFOX_BINARY: $FIREFOX_BINARY"
  run_mocha
  exit $?
fi

OS="$(uname -s)"
ARCH="$(uname -m)"

if [[ "$OS" != "Linux" || "$ARCH" != "x86_64" ]]; then
  echo "Unsupported platform ($OS $ARCH). Please set FIREFOX_BINARY manually." >&2
  exit 1
fi

if [[ -x "$FIREFOX_BIN" ]]; then
  FIREFOX_BINARY="$FIREFOX_BIN"
  log "Using cached Firefox Nightly: $FIREFOX_BINARY"
  run_mocha
  exit $?
fi

mkdir -p "$CACHE_DIR"

# Try to use a previously downloaded archive first.
if [[ -f "$ARCHIVE_PATH" ]]; then
  log "Found cached archive. Trying extraction…"
  if tar -xf "$ARCHIVE_PATH" -C "$CACHE_DIR"; then
    if [[ -x "$FIREFOX_BIN" ]]; then
      FIREFOX_BINARY="$FIREFOX_BIN"
      log "Using Firefox Nightly extracted from cached archive: $FIREFOX_BINARY"
      run_mocha
      exit $?
    else
      log "Extraction succeeded but binary not found; will re-download."
    fi
  else
    log "Cached archive extraction failed; will re-download."
  fi
fi

URL='https://download.mozilla.org/?product=firefox-nightly-latest-ssl&os=linux64&lang=en-US'
log "Downloading Firefox Nightly…"
if command -v curl >/dev/null 2>&1; then
  curl -L "$URL" -o "$ARCHIVE_PATH"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$ARCHIVE_PATH" "$URL"
else
  echo "Neither curl nor wget found. Cannot download Firefox Nightly." >&2
  exit 1
fi

log "Extracting Firefox Nightly…"
tar -xf "$ARCHIVE_PATH" -C "$CACHE_DIR"

if [[ ! -x "$FIREFOX_BIN" ]]; then
  echo "Firefox Nightly binary not found after extraction." >&2
  exit 1
fi

FIREFOX_BINARY="$FIREFOX_BIN"
log "Using downloaded Firefox Nightly: $FIREFOX_BINARY"
run_mocha
