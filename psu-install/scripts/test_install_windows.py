# Copyright 2026 The PSU-EXT Authors
# SPDX-License-Identifier: Apache-2.0

import hashlib
import http.server
import os
import pathlib
import subprocess
import sys
import tempfile
import threading
import unittest


INSTALLER = pathlib.Path(__file__).parent.parent


@unittest.skipUnless(sys.platform == "win32", "Windows bootstrap test")
class WindowsBootstrapTest(unittest.TestCase):
    def test_uses_overridden_http_release_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            assets = root / "latest" / "download"
            assets.mkdir(parents=True)
            binary = b"test windows installer"
            name = "psu-ext-windows-amd64.exe"
            (assets / name).write_bytes(binary)
            digest = hashlib.sha256(binary).hexdigest()
            (assets / "checksums.txt").write_text(f"{digest}  {name}\n")

            handler = lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(
                *args, directory=root, **kwargs
            )
            server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                target = root / "installed"
                environment = os.environ.copy()
                environment["PSU_EXT_RELEASE_BASE_URL"] = (
                    f"http://127.0.0.1:{server.server_port}/"
                )
                environment["PSU_EXT_BIN_DIR"] = str(target)
                subprocess.run(
                    [
                        "pwsh",
                        "-NoProfile",
                        "-File",
                        str(INSTALLER / "install-windows.ps1"),
                    ],
                    check=True,
                    env=environment,
                    capture_output=True,
                    text=True,
                )
                self.assertEqual((target / "psu-ext.exe").read_bytes(), binary)
            finally:
                server.shutdown()
                thread.join()
                server.server_close()


if __name__ == "__main__":
    unittest.main()
