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
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("installer runtime configuration", () => {
  it("provides local Caddy endpoint defaults", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        proxy: { scheme: "ws", host: "localhost", port: 18080, path: "/ws/scpi" },
        scriptRunner: { scheme: "http", host: "localhost", port: 18080, rootPath: "/runner" },
      }),
    }));
    const runtime = await import("./runtimeConfig.js");

    await runtime.loadRuntimeConfig();

    expect(runtime.getRuntimeWebSocketDefaults()).toMatchObject({ wsPort: "18080", wsPath: "/ws/scpi" });
    expect(runtime.getRuntimeScriptRunnerDefaults()).toMatchObject({ port: "18080", rootPath: "/runner" });
  });
});
