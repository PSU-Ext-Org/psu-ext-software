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
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useProtectionRuntime } from "../hooks/useProtectionRuntime.js";
import { DEFAULT_PROTECTION_CONTROL_CONFIG } from "../protectionConfig.js";

const config = {
  ...DEFAULT_PROTECTION_CONTROL_CONFIG,
  deviceName: "PSU1",
  valueQuery: "OVP? CH1",
  valueSetTemplate: "OVP CH1,{value}",
  tripQuery: "OVP:TRIP? CH1",
  enableQuery: "OVP:ENABLE? CH1",
  enableOnCommand: "OVP:ENABLE CH1,1",
  enableOffCommand: "OVP:ENABLE CH1,0",
  enabledResponse: "1",
  disabledResponse: "0",
  frequencyHz: 0.1,
};

function deferred() {
  let resolve;
  const promise = new Promise((complete) => { resolve = complete; });
  return { promise, resolve };
}

function readResponse(command) {
  if (command === config.valueQuery) {
    return { ok: true, response: "25" };
  }
  return { ok: true, response: command === config.enableQuery ? "1" : "0" };
}

afterEach(cleanup);

describe("protection request lifetime", () => {
  it.each(["threshold", "enable"])("discards a delayed %s write after disconnect", async (operation) => {
    const pending = deferred();
    const sendScpiCommand = vi.fn((command) => command.includes("?")
      ? Promise.resolve(readResponse(command))
      : pending.promise);
    const { result, rerender } = renderHook(
      ({ runnable }) => useProtectionRuntime({
        config, placementId: "protection-main", runnable, sendScpiCommand,
      }),
      { initialProps: { runnable: true } },
    );
    await waitFor(() => expect(result.current.runtime.thresholdValue).toBe("25"));
    act(() => result.current.setDraftValue("20"));
    let writing;
    act(() => {
      writing = operation === "threshold"
        ? result.current.handleApplyThreshold()
        : result.current.handleToggleEnabled();
    });
    const requestCount = sendScpiCommand.mock.calls.length;
    expect(result.current.runtime.loading).toBe(true);

    rerender({ runnable: false });
    await act(async () => {
      pending.resolve({ ok: true, response: "OK" });
      await writing;
    });

    expect(sendScpiCommand).toHaveBeenCalledTimes(requestCount);
    expect(result.current.runtime).toMatchObject({ thresholdValue: "", loading: false });
    expect(result.current.draftValue).toBe("");

    rerender({ runnable: true });
    await waitFor(() => expect(result.current.runtime.thresholdValue).toBe("25"));
    expect(sendScpiCommand).toHaveBeenCalledTimes(requestCount + 3);
  });

  it("ignores old read results after the device disconnects", async () => {
    const pending = deferred();
    const sendScpiCommand = vi.fn((command) => command === config.valueQuery
      ? pending.promise
      : Promise.resolve(readResponse(command)));
    const { result, rerender } = renderHook(
      ({ runnable }) => useProtectionRuntime({
        config, placementId: "protection-main", runnable, sendScpiCommand,
      }),
      { initialProps: { runnable: true } },
    );
    rerender({ runnable: false });
    await act(async () => {
      pending.resolve({ ok: true, response: "25" });
      await pending.promise;
    });
    expect(result.current.runtime).toMatchObject({ thresholdValue: "", loading: false });
  });
});
