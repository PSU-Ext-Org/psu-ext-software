#!/usr/bin/env bash
# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

version="${1:?usage: assemble-macos.sh VERSION}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
work="$root/psu-install/build/darwin-arm64"
bundle="$work/psu-ext-bundle-darwin-arm64"
dist="$root/psu-install/dist"
descriptor="$root/psu-install/platforms/darwin-arm64.json"
platform_value="$root/psu-install/scripts/platform-value.py"
caddy_url="$(python3 "$platform_value" "$descriptor" components.caddy.url)"
caddy_sha512="$(python3 "$platform_value" "$descriptor" components.caddy.sha512)"
temurin_url="$(python3 "$platform_value" "$descriptor" components.temurin.url)"
temurin_sha256="$(python3 "$platform_value" "$descriptor" components.temurin.sha256)"

verify_executable_jar() {
    python3 - "$1" <<'PY'
import sys, zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    manifest = archive.read("META-INF/MANIFEST.MF").decode("utf-8")
if "Main-Class: org.springframework.boot.loader.launch.JarLauncher" not in manifest:
    raise SystemExit(f"{sys.argv[1]} is not an executable Spring Boot JAR")
if "Start-Class: " not in manifest:
    raise SystemExit(f"{sys.argv[1]} has no Spring Boot Start-Class")
PY
}

verify_checksum() {
    algorithm="$1"
    expected="$2"
    path="$3"
    actual="$(shasum -a "$algorithm" "$path" | awk '{print $1}')"
    [ "$actual" = "$expected" ] || { echo "checksum mismatch for $path" >&2; exit 1; }
}

rm -rf "$work" "$dist"
mkdir -p "$bundle/apps" "$bundle/frontend" "$bundle/runtime" "$bundle/bin" "$bundle/licenses" "$dist"

pushd "$root/psu-be" >/dev/null
./mvnw -B -pl psu-be-proxy,psu-be-script-runner -am package
cp psu-be-proxy/target/psu-be-proxy-*.jar "$bundle/apps/psu-be-proxy.jar"
cp psu-be-script-runner/target/psu-be-script-runner-*.jar "$bundle/apps/psu-be-script-runner.jar"
verify_executable_jar "$bundle/apps/psu-be-proxy.jar"
verify_executable_jar "$bundle/apps/psu-be-script-runner.jar"
popd >/dev/null

pushd "$root/psu-fe" >/dev/null
npm ci
npm run build
cp -R dist/. "$bundle/frontend/"
popd >/dev/null

curl --fail --location --silent --show-error "$caddy_url" --output "$work/caddy.tar.gz"
verify_checksum 512 "$caddy_sha512" "$work/caddy.tar.gz"
tar -xzf "$work/caddy.tar.gz" -C "$bundle/bin" caddy LICENSE
curl --fail --location --silent --show-error "$temurin_url" --output "$work/temurin.tar.gz"
verify_checksum 256 "$temurin_sha256" "$work/temurin.tar.gz"
# A macOS JDK archive stores the runtime below <jdk>/Contents/Home.
tar -xzf "$work/temurin.tar.gz" --strip-components=3 -C "$bundle/runtime"
cp "$bundle/bin/LICENSE" "$bundle/licenses/CADDY-LICENSE"
cp -R "$bundle/runtime/legal" "$bundle/licenses/temurin-legal"
cp "$root/psu-install/THIRD-PARTY-NOTICES.md" "$bundle/licenses/THIRD-PARTY-NOTICES.md"

tar -chzf "$dist/psu-ext-bundle-darwin-arm64.tar.gz" -C "$bundle" .
(cd "$root/psu-install" && GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags='-s -w' -o dist/psu-ext-darwin-arm64 ./cmd/psu-ext)
python3 "$root/psu-install/scripts/generate-release-metadata.py" "$version" "$dist"
