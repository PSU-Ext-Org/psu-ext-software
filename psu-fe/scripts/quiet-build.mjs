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

const viteEntry = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const child = spawn(process.execPath, [viteEntry, "build"], {
  env: process.env,
  shell: false,
  stdio: ["ignore", "pipe", "pipe"],
});
const output = [];

child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.on("data", (chunk) => output.push(chunk));
child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on("close", (code) => {
  if (code === 0) {
    console.log("vite build: OK");
    return;
  }

  process.stdout.write(Buffer.concat(output).toString());
  process.exit(code || 1);
});
