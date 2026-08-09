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
import {
  abbreviateMonitorUuids,
  createMonitorBuffer,
  extractMonitorTags,
  filterMonitorByTags,
  formatMonitorLine,
  MAX_MONITOR_BYTES,
  MAX_MONITOR_LINES,
  trimMonitor,
} from "./monitorLog.js";

describe("monitorLog", () => {
  it("formats monitor lines", () => {
    const date = new Date(2026, 4, 10, 7, 30, 5, 42);

    expect(formatMonitorLine("out", "/status", "SYSTEM", "uuid-1", date)).toBe(
      "[2026-05-10 07:30:05.042] [SYSTEM] OUT [uuid-1] /status\n",
    );
  });

  it("defaults monitor lines to the system tag", () => {
    const date = new Date(2026, 4, 10, 7, 30, 5, 42);

    expect(formatMonitorLine("error", "Cannot send", undefined, "", date)).toBe(
      "[2026-05-10 07:30:05.042] [SYSTEM] ERROR Cannot send\n",
    );
  });

  it("pads inbound monitor lines for UUID alignment", () => {
    const date = new Date(2026, 4, 10, 7, 30, 5, 42);

    expect(formatMonitorLine("in", "12.34", "USER", "uuid-1", date)).toBe(
      "[2026-05-10 07:30:05.042] [USER] IN_ [uuid-1] 12.34\n",
    );
  });

  it("trims monitor content to latest bytes", () => {
    const value = "a".repeat(MAX_MONITOR_BYTES + 10);

    expect(trimMonitor(value)).toHaveLength(MAX_MONITOR_BYTES);
    expect(trimMonitor("short")).toBe("short");
  });

  it("extracts unique sorted tags from monitor text", () => {
    const value = [
      "[2026-05-10 07:30:05.042] [USER] OUT MEAS:VOLT?",
      "[2026-05-10 07:30:05.043] [SYSTEM] IN 12.34",
      "[2026-05-10 07:30:05.044] [USER] IN 12.35",
      "[2026-05-10 07:30:05.045] [WIDGET] OUT OUTP?",
    ].join("\n");

    expect(extractMonitorTags(value)).toEqual(["SYSTEM", "USER", "WIDGET"]);
  });

  it("ignores malformed and untagged lines when extracting tags", () => {
    const value = [
      "[2026-05-10 07:30:05.042] OUT legacy line",
      "not a monitor line",
      "[2026-05-10 07:30:05.043] [USER] OUT MEAS:VOLT?",
    ].join("\n");

    expect(extractMonitorTags(value)).toEqual(["USER"]);
  });

  it("returns original text when no tags are selected", () => {
    const value = "[2026-05-10 07:30:05.042] [SYSTEM] OUT /status\n";

    expect(filterMonitorByTags(value, [])).toBe(value);
  });

  it("filters monitor text by one selected tag", () => {
    const value = [
      "[2026-05-10 07:30:05.042] [SYSTEM] OUT /status",
      "[2026-05-10 07:30:05.043] [USER] OUT MEAS:VOLT?",
      "[2026-05-10 07:30:05.044] [SYSTEM] IN STATUS state=CONNECTED",
    ].join("\n");

    expect(filterMonitorByTags(value, ["USER"])).toBe(
      "[2026-05-10 07:30:05.043] [USER] OUT MEAS:VOLT?\n",
    );
  });

  it("filters monitor text by multiple selected tags", () => {
    const value = [
      "[2026-05-10 07:30:05.042] [SYSTEM] OUT /status",
      "[2026-05-10 07:30:05.043] [USER] OUT MEAS:VOLT?",
      "[2026-05-10 07:30:05.044] [WIDGET] OUT OUTP?",
    ].join("\n");

    expect(filterMonitorByTags(value, ["SYSTEM", "WIDGET"])).toBe(
      [
        "[2026-05-10 07:30:05.042] [SYSTEM] OUT /status",
        "[2026-05-10 07:30:05.044] [WIDGET] OUT OUTP?",
      ].join("\n"),
    );
  });

  it("abbreviates visible UUIDs without changing non-UUID text", () => {
    const value = [
      "[2026-05-10 07:30:05.042] [SYSTEM] OUT [54f2f602-98db-4c14-8168-b4ec58e2d8dc] /status",
      "[2026-05-10 07:30:05.043] [USER] IN [not-a-uuid] OK",
    ].join("\n");

    expect(abbreviateMonitorUuids(value)).toBe(
      [
        "[2026-05-10 07:30:05.042] [SYSTEM] OUT [54f2f602] /status",
        "[2026-05-10 07:30:05.043] [USER] IN [not-a-uuid] OK",
      ].join("\n"),
    );
  });

  it("stores monitor entries in a bounded line buffer with sorted tags", () => {
    const buffer = createMonitorBuffer();

    buffer.append("[2026-05-10 07:30:05.042] [USER] OUT MEAS:VOLT?\n");
    buffer.append("[2026-05-10 07:30:05.043] [SYSTEM] IN 12.34\n");

    expect(buffer.getText()).toContain("[USER] OUT MEAS:VOLT?");
    expect(buffer.getTags()).toEqual(["SYSTEM", "USER"]);

    for (let index = 0; index < MAX_MONITOR_LINES + 5; index += 1) {
      buffer.append(`[2026-05-10 07:30:05.044] [SYSTEM] IN ${index}\n`);
    }

    expect(buffer.getText().match(/[^\n]*\n|[^\n]+/g)).toHaveLength(MAX_MONITOR_LINES);
    expect(buffer.getText()).not.toContain("MEAS:VOLT?");
    expect(buffer.getTags()).toEqual(["SYSTEM"]);
  });
});
