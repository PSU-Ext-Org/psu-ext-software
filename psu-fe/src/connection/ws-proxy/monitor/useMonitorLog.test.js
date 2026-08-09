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
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MONITOR_TAG } from "./monitorTagQueue.js";
import { useMonitorLog } from "./useMonitorLog.js";

describe("useMonitorLog", () => {
  it("appends and clears tagged monitor messages", () => {
    const { result } = renderHook(() => useMonitorLog());

    act(() => {
      result.current.appendWsMessage("out", "MEAS:VOLT?", MONITOR_TAG.USER, "uuid-1");
    });

    expect(result.current.getWsMessages()).toContain("[USER] OUT [uuid-1] MEAS:VOLT?");

    act(() => {
      result.current.clearWsMessages();
    });

    expect(result.current.getWsMessages()).toBe("");
  });

  it("notifies active monitor subscribers when messages change", () => {
    const { result } = renderHook(() => useMonitorLog());
    const listener = vi.fn();

    act(() => {
      result.current.subscribeWsMessages(listener);
      result.current.appendWsMessage("out", "MEAS:VOLT?", MONITOR_TAG.SCHEDULER, "uuid-1");
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(result.current.getWsMessages()).toContain("[SCHEDULER] OUT [uuid-1] MEAS:VOLT?");
    expect(result.current.getWsTags()).toEqual([MONITOR_TAG.SCHEDULER]);
  });

  it("matches response tags by UUID", () => {
    const { result } = renderHook(() => useMonitorLog());

    act(() => {
      result.current.trackResponseTag("uuid-1", MONITOR_TAG.USER);
      result.current.trackResponseTag("uuid-2", MONITOR_TAG.SYSTEM);
    });

    expect(result.current.consumeResponseTag("uuid-1")).toBe(MONITOR_TAG.USER);
    expect(result.current.consumeResponseTag("uuid-2")).toBe(MONITOR_TAG.SYSTEM);

    act(() => {
      result.current.trackResponseTag("uuid-3", MONITOR_TAG.USER);
      result.current.clearResponseTags();
    });

    expect(result.current.consumeResponseTag("uuid-3")).toBe(MONITOR_TAG.SYSTEM);
  });
});
