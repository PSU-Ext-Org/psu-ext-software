#!/usr/bin/env sh
# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0
set -eu

repo="PSU-Ext-Org/psu-ext-software"
target_dir="${PSU_EXT_BIN_DIR:-$HOME/.local/bin}"
binary="psu-ext-linux-amd64"
base_url="https://github.com/$repo/releases/latest/download"

mkdir -p "$target_dir"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
curl --fail --location --silent --show-error "$base_url/$binary" --output "$tmp_dir/$binary"
curl --fail --location --silent --show-error "$base_url/checksums.txt" --output "$tmp_dir/checksums.txt"
(cd "$tmp_dir" && grep "  $binary$" checksums.txt | sha256sum --check --status -)
install -m 0755 "$tmp_dir/$binary" "$target_dir/psu-ext"
echo "Installed $target_dir/psu-ext. Ensure $target_dir is on PATH, then run: psu-ext install"
