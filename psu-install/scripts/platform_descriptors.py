# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0

import json
import pathlib


REQUIRED_FIELDS = {"platform", "runner", "assemble", "checkBootstrap", "installer", "bundle"}
ARTIFACT_FIELDS = ("installer", "bundle")


def load_platforms(directory: pathlib.Path) -> list[dict]:
    """Load and validate every additive release-platform descriptor."""
    targets = []
    platform_names = set()
    artifact_names = set()

    for path in sorted(directory.glob("*.json")):
        target = json.loads(path.read_text())
        missing = REQUIRED_FIELDS - target.keys()
        if missing:
            raise ValueError(f"{path} is missing: {', '.join(sorted(missing))}")
        if target["platform"] != path.stem:
            raise ValueError(f"{path} must describe platform {path.stem}")
        if target["platform"] in platform_names:
            raise ValueError(f"duplicate platform {target['platform']}")

        for field in ARTIFACT_FIELDS:
            artifact = target[field]
            if pathlib.PurePosixPath(artifact).name != artifact or "\\" in artifact:
                raise ValueError(f"{path} {field} must be a plain filename")
            if artifact in artifact_names:
                raise ValueError(f"duplicate release artifact {artifact}")
            artifact_names.add(artifact)

        platform_names.add(target["platform"])
        targets.append(target)

    if not targets:
        raise ValueError(f"no platform descriptors found in {directory}")
    return targets
