#!/usr/bin/env python3
# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0

import hashlib
import json
import pathlib
import sys

from platform_descriptors import load_platforms


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    require_all = "--require-all" in sys.argv[1:]
    arguments = [argument for argument in sys.argv[1:] if argument != "--require-all"]
    if len(arguments) != 2:
        raise SystemExit("usage: generate-release-metadata.py [--require-all] VERSION DIST")
    version, dist_value = arguments
    dist = pathlib.Path(dist_value)
    platform_directory = pathlib.Path(__file__).parent.parent / "platforms"
    assets = {}
    published = []
    try:
        descriptors = load_platforms(platform_directory)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise SystemExit(error) from error
    for descriptor in descriptors:
        bundle = dist / descriptor["bundle"]
        installer = dist / descriptor["installer"]
        available = bundle.is_file() and installer.is_file()
        if bundle.is_file() != installer.is_file():
            raise SystemExit(f"incomplete {descriptor['platform']} release artifacts in {dist}")
        if require_all and not available:
            raise SystemExit(f"missing {descriptor['platform']} release artifacts in {dist}")
        if available:
            assets[descriptor["platform"]] = {"name": bundle.name, "sha256": sha256(bundle)}
            published.extend([installer, bundle])
    if not assets:
        raise SystemExit(f"no release bundles found in {dist}")
    manifest = {"version": version, "assets": assets}
    (dist / "release-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    lines = [f"{sha256(path)}  {path.name}" for path in sorted(published)]
    (dist / "checksums.txt").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
