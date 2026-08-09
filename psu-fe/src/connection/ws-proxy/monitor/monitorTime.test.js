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
import { describe, expect, it } from "vitest";
import { formatMonitorDownloadTimestamp, formatMonitorTimestamp } from "./monitorTime.js";

describe("monitorTime", () => {
  it("formats monitor line timestamps", () => {
    const date = new Date(2026, 4, 10, 7, 30, 5, 42);

    expect(formatMonitorTimestamp(date)).toBe("2026-05-10 07:30:05.042");
  });

  it("formats filesystem-friendly download timestamps", () => {
    const date = new Date(2026, 4, 10, 7, 30, 5, 42);

    expect(formatMonitorDownloadTimestamp(date)).toBe("20260510-073005");
  });
});
