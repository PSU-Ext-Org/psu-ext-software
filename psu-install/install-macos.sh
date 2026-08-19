#!/usr/bin/env sh
# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0
#
# Downloads the latest Apple Silicon macOS psu-ext CLI, verifies its published
# SHA-256 checksum, and installs it as ~/.local/bin/psu-ext by default.
set -eu

if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
    echo "psu-ext: install-macos.sh requires Apple Silicon macOS" >&2
    exit 1
fi

binary="psu-ext-darwin-arm64"
target_dir="${PSU_EXT_BIN_DIR:-$HOME/.local/bin}"
release_root="${PSU_EXT_RELEASE_BASE_URL:-https://github.com/PSU-Ext-Org/psu-ext-software/releases}"
base_url="${release_root%/}/latest/download"

temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT
mkdir -p "$target_dir"

echo "Downloading the Apple Silicon macOS CLI: $binary"
curl --fail --location --silent --show-error "$base_url/$binary" --output "$temporary_dir/$binary"
curl --fail --location --silent --show-error "$base_url/checksums.txt" --output "$temporary_dir/checksums.txt"

expected="$(awk -v name="$binary" '$2 == name {print $1}' "$temporary_dir/checksums.txt")"
if [ -z "$expected" ]; then
    echo "psu-ext: checksums.txt has no entry for $binary" >&2
    exit 1
fi
actual="$(shasum -a 256 "$temporary_dir/$binary" | awk '{print $1}')"
if [ "$actual" != "$expected" ]; then
    echo "psu-ext: checksum verification failed for $binary" >&2
    exit 1
fi

install -m 0755 "$temporary_dir/$binary" "$target_dir/psu-ext"
echo "Installed $target_dir/psu-ext"
echo "Ensure $target_dir is on PATH, then run: psu-ext install"
