#!/usr/bin/env python3
# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0

import json
import pathlib
import sys

from platform_descriptors import REQUIRED_FIELDS, load_platforms


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: platform-matrix.py PLATFORM_DIRECTORY")
    directory = pathlib.Path(sys.argv[1])
    try:
        descriptors = load_platforms(directory)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        raise SystemExit(error) from error
    targets = [{field: target[field] for field in sorted(REQUIRED_FIELDS)} for target in descriptors]
    print("matrix=" + json.dumps({"include": targets}, separators=(",", ":")))


if __name__ == "__main__":
    main()
