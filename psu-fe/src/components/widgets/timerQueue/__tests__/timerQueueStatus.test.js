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
import { describe, expect, it, vi } from "vitest";
import {
  createRuntimeFromStatusResponse,
  formatRemaining,
  parseTimerStatusResponse,
  updateRuntimeAfterCompletion,
} from "../utils/timerQueueStatus.js";

describe("timerQueueStatus", () => {
  it("parses status responses and identifies presets that are not loaded", () => {
    expect(parseTimerStatusResponse("A01,RUNNING,2.500")).toEqual({
      activeId: "A01",
      remainingMs: 2500,
      state: "RUNNING",
    });
    expect(createRuntimeFromStatusResponse("NONE,IDLE,0.000", [{ id: "A01" }]))
      .toMatchObject({ message: "Preset not loaded", queueLoaded: false });
  });

  it("formats durations and advances local progress to the next timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const nextRuntime = updateRuntimeAfterCompletion({
      configTimers: [
        { id: "A01", durationSeconds: "1" },
        { id: "A02", durationSeconds: "2.500" },
      ],
      runtime: { activeId: "A01" },
    });

    expect(formatRemaining(62501)).toBe("01:02.501");
    expect(nextRuntime).toMatchObject({ activeId: "A02", remainingMs: 2500, state: "RUNNING" });
    vi.useRealTimers();
  });
});
