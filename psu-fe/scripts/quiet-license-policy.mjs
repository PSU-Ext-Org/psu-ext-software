/**
 * Copyright 2026 The PSU-EXT Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ALLOWED_LICENSES = [
  "MIT",
  "ISC",
  "Apache-2.0",
  "Apache 2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "MIT-0",
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-3.0",
  "MPL-2.0",
  "BlueOak-1.0.0",
  "(MIT AND CC-BY-3.0)",
].join(";");

const checkerEntry = fileURLToPath(new URL("../node_modules/@lizenz/checker/dist/cli.js", import.meta.url));
const child = spawn(
  process.execPath,
  [checkerEntry, "--excludePrivatePackages", "--onlyAllow", ALLOWED_LICENSES],
  {
    env: process.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const output = [];

child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.on("data", (chunk) => output.push(chunk));
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on("close", (code) => {
  if (code === 0) {
    console.log("license policy: OK");
    return;
  }

  process.stdout.write(Buffer.concat(output).toString());
  process.exit(code || 1);
});
