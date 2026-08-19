#!/usr/bin/env sh
# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0
#
# Downloads the latest Linux x86-64 psu-ext CLI, verifies its published
# SHA-256 checksum, and installs it as ~/.local/bin/psu-ext by default.
set -eu

if [ "$(uname -s)" != "Linux" ] || [ "$(uname -m)" != "x86_64" ]; then
    echo "psu-ext: install-linux.sh requires Linux x86-64" >&2
    exit 1
fi

binary="psu-ext-linux-amd64"
target_dir="${PSU_EXT_BIN_DIR:-$HOME/.local/bin}"
release_root="${PSU_EXT_RELEASE_BASE_URL:-https://github.com/PSU-Ext-Org/psu-ext-software/releases}"
base_url="${release_root%/}/latest/download"

temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT
mkdir -p "$target_dir"

echo "Downloading the Linux x86-64 CLI: $binary"
curl --fail --location --silent --show-error "$base_url/$binary" --output "$temporary_dir/$binary"
curl --fail --location --silent --show-error "$base_url/checksums.txt" --output "$temporary_dir/checksums.txt"

expected="$(awk -v name="$binary" '$2 == name {print $1}' "$temporary_dir/checksums.txt")"
if [ -z "$expected" ]; then
    echo "psu-ext: checksums.txt has no entry for $binary" >&2
    exit 1
fi
actual="$(sha256sum "$temporary_dir/$binary" | awk '{print $1}')"
if [ "$actual" != "$expected" ]; then
    echo "psu-ext: checksum verification failed for $binary" >&2
    exit 1
fi

install -m 0755 "$temporary_dir/$binary" "$target_dir/psu-ext"
echo "Installed $target_dir/psu-ext"
echo "Ensure $target_dir is on PATH, then run: psu-ext install"
