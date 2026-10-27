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
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScpiQueryScheduler } from "./useScpiQueryScheduler.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderScheduler(overrides = {}) {
  let nextRequestId = 0;
  const deviceState = {
    devices: [{ id: "0", name: "PSU1" }, { id: "1", name: "USB1" }],
    deviceStatuses: { 0: { state: "CONNECTED" }, 1: { state: "CONNECTED" } },
  };
  const options = {
    sendWsMessage: vi.fn(() => `uuid-${++nextRequestId}`),
    wsConnectedRef: { current: true },
    getDeviceState: () => deviceState,
    ...overrides,
  };
  return { options, deviceState, ...renderHook(() => useScpiQueryScheduler(options)) };
}

function subscribe(api, widgetId, deviceName, query = "MEAS:VOLT?") {
  return api.subscribeScpiQuery({ widgetId, deviceName, query, frequencyHz: 1 });
}

describe("scheduler lifecycle", () => {
  it("invalidates every query for a disconnected device without clearing other devices", () => {
    const onScpiError = vi.fn(() => true);
    const { result } = renderScheduler({ onScpiError });
    act(() => {
      subscribe(result.current, "usb-voltage", "USB1");
      subscribe(result.current, "usb-current", "USB1", "MEAS:CURR?");
      subscribe(result.current, "psu-voltage", "PSU1");
      result.current.handleScpiSchedulerMessage({ uuid: "uuid-3", payload: "5" });
    });
    const healthy = result.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?");
    act(() => {
      result.current.handleScpiSchedulerMessage({ uuid: "uuid-1", payload: "ERR DISCONNECTED removed" });
    });
    expect(onScpiError).toHaveBeenCalledExactlyOnceWith("USB1", "ERR DISCONNECTED removed");
    for (const query of ["MEAS:VOLT?", "MEAS:CURR?"]) {
      expect(result.current.getScpiQuerySnapshot("USB1", query)).toMatchObject({
        disconnected: true, value: "", loading: false, error: "",
      });
    }
    expect(result.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?")).toBe(healthy);
    expect(result.current.handleScpiSchedulerBinaryMessage({
      uuid: "uuid-2",
      payload: "late-binary-response",
    })).toBe(false);
  });

  it("retains snapshot listeners across public clear and rejects old replies", () => {
    const { result } = renderScheduler();
    const listener = vi.fn();
    let unsubscribeSnapshot;
    act(() => {
      unsubscribeSnapshot = result.current.subscribeScpiSnapshot("PSU1", "MEAS:VOLT?", listener);
      subscribe(result.current, "voltage", "PSU1");
      result.current.clearScpiScheduler();
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.handleScpiSchedulerMessage({ uuid: "uuid-1", payload: "99" })).toBe(false);
    expect(result.current.getScpiQuerySnapshot("PSU1", "MEAS:VOLT?")).toMatchObject({
      disconnected: false, value: "", loading: false,
    });
    listener.mockClear();
    act(() => subscribe(result.current, "voltage", "PSU1"));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribeSnapshot();
    act(() => result.current.handleScpiSchedulerMessage({ uuid: "uuid-2", payload: "12" }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears polling and pending responses when unmounted", () => {
    const { result, options, unmount } = renderScheduler();
    act(() => subscribe(result.current, "voltage", "PSU1"));
    const api = result.current;
    unmount();
    options.sendWsMessage.mockClear();
    act(() => vi.advanceTimersByTime(10_000));
    expect(vi.getTimerCount()).toBe(0);
    expect(options.sendWsMessage).not.toHaveBeenCalled();
    expect(api.handleScpiSchedulerMessage({ uuid: "uuid-1", payload: "99" })).toBe(false);
  });

  it("keeps facade callbacks stable while using current runtime dependencies", () => {
    const { result, options, rerender } = renderScheduler();
    const original = result.current;
    const updatedSend = vi.fn(() => "updated-uuid");
    options.sendWsMessage = updatedSend;
    rerender();
    expect(result.current).toBe(original);
    act(() => subscribe(result.current, "voltage", "PSU1"));
    expect(updatedSend).toHaveBeenCalledExactlyOnceWith("CMD PSU1 MEAS:VOLT?", "SCHEDULER");
  });
});
