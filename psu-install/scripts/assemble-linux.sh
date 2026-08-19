#!/usr/bin/env bash
# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

version="${1:?usage: assemble-linux.sh VERSION}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
work="$root/psu-install/build/linux-amd64"
bundle="$work/psu-ext-bundle-linux-amd64"
dist="$root/psu-install/dist"
caddy_url="https://github.com/caddyserver/caddy/releases/download/v2.10.2/caddy_2.10.2_linux_amd64.tar.gz"
caddy_sha512="747df7ee74de188485157a383633a1a963fd9233b71fbb4a69ddcbcc589ce4e2cc82dacf5dbbe136cb51d17e14c59daeb5d9bc92487610b0f3b93680b2646546"
temurin_url="https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.1%2B8/OpenJDK25U-jdk_x64_linux_hotspot_25.0.1_8.tar.gz"
temurin_sha256="8daf77d1aacffe38c9889689bc224a13557de77559d9a5bb91991e6a298baa0d"

verify_executable_jar() {
    python3 - "$1" <<'PY'
import sys, zipfile

path = sys.argv[1]
with zipfile.ZipFile(path) as archive:
    manifest = archive.read("META-INF/MANIFEST.MF").decode("utf-8")
if "Main-Class: org.springframework.boot.loader.launch.JarLauncher" not in manifest:
    raise SystemExit(f"{path} is not an executable Spring Boot JAR: missing Main-Class")
if "Start-Class: " not in manifest:
    raise SystemExit(f"{path} is not an executable Spring Boot JAR: missing Start-Class")
PY
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
echo "$caddy_sha512  $work/caddy.tar.gz" | sha512sum --check --status
tar -xzf "$work/caddy.tar.gz" -C "$bundle/bin" caddy LICENSE
curl --fail --location --silent --show-error "$temurin_url" --output "$work/temurin.tar.gz"
echo "$temurin_sha256  $work/temurin.tar.gz" | sha256sum --check --status
tar -xzf "$work/temurin.tar.gz" --strip-components=1 -C "$bundle/runtime"
cp "$bundle/bin/LICENSE" "$bundle/licenses/CADDY-LICENSE"
cp -R "$bundle/runtime/legal" "$bundle/licenses/temurin-legal"
cp "$root/psu-install/THIRD-PARTY-NOTICES.md" "$bundle/licenses/THIRD-PARTY-NOTICES.md"

# The installer deliberately accepts only directories and regular files. Materialize
# links from the bundled JDK so the release archive preserves that extraction contract.
tar --dereference --hard-dereference -C "$bundle" -czf "$dist/psu-ext-bundle-linux-amd64.tar.gz" .
(cd "$dist" && sha256sum psu-ext-bundle-linux-amd64.tar.gz > checksums.txt)
python3 - "$version" "$dist/psu-ext-bundle-linux-amd64.tar.gz" > "$dist/release-manifest.json" <<'PY'
import hashlib, json, pathlib, sys
version, asset = sys.argv[1:]
path = pathlib.Path(asset)
print(json.dumps({"version": version, "assets": {"linux-amd64": {"name": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}}}, indent=2))
PY
