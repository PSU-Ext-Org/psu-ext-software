#!/usr/bin/env python3
# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0

import json
import pathlib
import sys


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: platform-value.py DESCRIPTOR DOTTED_KEY")
    descriptor, dotted_key = sys.argv[1:]
    value = json.loads(pathlib.Path(descriptor).read_text())
    for part in dotted_key.split("."):
        value = value[part]
    if not isinstance(value, str):
        raise SystemExit(f"{dotted_key} is not a string")
    print(value)


if __name__ == "__main__":
    main()
