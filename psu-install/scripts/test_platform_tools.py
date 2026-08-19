# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest


SCRIPTS = pathlib.Path(__file__).parent
INSTALLER = SCRIPTS.parent


class PlatformToolsTest(unittest.TestCase):
    @staticmethod
    def descriptor(platform: str, installer: str | None = None, bundle: str | None = None) -> dict:
        return {
            "platform": platform,
            "runner": "example-runner",
            "assemble": "example-assemble",
            "checkBootstrap": "example-check",
            "installer": installer or f"psu-ext-{platform}",
            "bundle": bundle or f"psu-ext-bundle-{platform}.tar.gz",
        }

    def test_matrix_contains_every_descriptor(self) -> None:
        result = subprocess.run(
            [sys.executable, SCRIPTS / "platform-matrix.py", INSTALLER / "platforms"],
            check=True,
            capture_output=True,
            text=True,
        )
        matrix = json.loads(result.stdout.removeprefix("matrix="))
        discovered = {target["platform"] for target in matrix["include"]}
        expected = {path.stem for path in (INSTALLER / "platforms").glob("*.json")}
        self.assertEqual(discovered, expected)

    def test_matrix_accepts_a_new_descriptor_without_code_changes(self) -> None:
        descriptor = self.descriptor("example-arm64")
        with tempfile.TemporaryDirectory() as temporary:
            path = pathlib.Path(temporary) / "example-arm64.json"
            path.write_text(json.dumps(descriptor))
            result = subprocess.run(
                [sys.executable, SCRIPTS / "platform-matrix.py", temporary],
                check=True,
                capture_output=True,
                text=True,
            )
            matrix = json.loads(result.stdout.removeprefix("matrix="))
            self.assertEqual(matrix["include"], [descriptor])

    def test_matrix_rejects_duplicate_artifact_names(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            first = self.descriptor("first-arm64", installer="psu-ext-shared")
            second = self.descriptor("second-arm64", installer="psu-ext-shared")
            (directory / "first-arm64.json").write_text(json.dumps(first))
            (directory / "second-arm64.json").write_text(json.dumps(second))
            result = subprocess.run(
                [sys.executable, SCRIPTS / "platform-matrix.py", directory],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("duplicate release artifact", result.stderr)

    def test_matrix_rejects_artifact_paths(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            directory = pathlib.Path(temporary)
            descriptor = self.descriptor("example-arm64", bundle="nested/bundle.tar.gz")
            (directory / "example-arm64.json").write_text(json.dumps(descriptor))
            result = subprocess.run(
                [sys.executable, SCRIPTS / "platform-matrix.py", directory],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("plain filename", result.stderr)

    def test_metadata_uses_available_descriptor_artifacts(self) -> None:
        descriptor = json.loads((INSTALLER / "platforms" / "darwin-arm64.json").read_text())
        with tempfile.TemporaryDirectory() as temporary:
            dist = pathlib.Path(temporary)
            (dist / descriptor["installer"]).write_bytes(b"installer")
            (dist / descriptor["bundle"]).write_bytes(b"bundle")
            subprocess.run(
                [sys.executable, SCRIPTS / "generate-release-metadata.py", "1.2.3", dist],
                check=True,
            )
            manifest = json.loads((dist / "release-manifest.json").read_text())
            self.assertEqual(set(manifest["assets"]), {"darwin-arm64"})
            checksums = (dist / "checksums.txt").read_text()
            self.assertIn(descriptor["installer"], checksums)
            self.assertIn(descriptor["bundle"], checksums)

    def test_require_all_rejects_missing_platform(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            result = subprocess.run(
                [sys.executable, SCRIPTS / "generate-release-metadata.py", "--require-all", "1.2.3", temporary],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("missing", result.stderr)


if __name__ == "__main__":
    unittest.main()
