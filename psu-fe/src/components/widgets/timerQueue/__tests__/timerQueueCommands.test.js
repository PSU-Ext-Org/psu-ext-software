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
import { runTimerQueueAction } from "../utils/timerQueueCommands.js";

describe("runTimerQueueAction", () => {
  it("uploads a preset to the fixed timer channel before starting it", async () => {
    const sendScpiCommand = vi.fn().mockResolvedValue({ ok: true, response: "OK" });
    const result = await runTimerQueueAction({
      config: {
        deviceName: "PSU1",
        timers: [{ id: "A01", durationSeconds: "5.000", relayOnAfterExpiry: true }],
      },
      displayedRemainingMs: 0,
      runtime: { queueLoaded: false, state: "IDLE" },
      sendScpiCommand,
    });

    expect(sendScpiCommand).toHaveBeenNthCalledWith(1, "TIM:CLE CH1", "PSU1", { tag: "GUI", waitForResponse: true });
    expect(sendScpiCommand).toHaveBeenNthCalledWith(2, "TIM:ADD CH1,A01,5.000,1", "PSU1", { tag: "GUI", waitForResponse: true });
    expect(sendScpiCommand).toHaveBeenNthCalledWith(3, "TIM:START CH1", "PSU1", { tag: "GUI", waitForResponse: true });
    expect(result.runtime).toMatchObject({ activeId: "A01", queueLoaded: true, state: "RUNNING" });
  });
});
