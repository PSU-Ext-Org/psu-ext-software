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
import { act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEVICE_LIST, renderDeviceConnection } from "./deviceConnectionTestFixtures.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("device cleanup and independent timeouts", () => {
  it("reports unavailable devices without owning widget storage", () => {
    const onDeviceUnavailable = vi.fn();
    const { result } = renderDeviceConnection({ wsConnected: true, onDeviceUnavailable });
    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.updateDeviceStateFromMessage("STATUS id=1 name=USB1 state=CONNECTED");
      result.current.checkDeviceStatusAfterError("USB1", "ERR DISCONNECTED removed");
    });
    expect(onDeviceUnavailable).toHaveBeenCalledExactlyOnceWith("USB1");
    act(() => result.current.resetDeviceState());
    expect(onDeviceUnavailable.mock.calls).toEqual([["USB1"], ["PSU1"], ["USB1"]]);
  });

  it("keeps each device's ten-second connect timeout independent", () => {
    const { result } = renderDeviceConnection();
    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.connectDevice("0");
      vi.advanceTimersByTime(5000);
      result.current.connectDevice("1");
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.deviceStatuses["0"].state).toBe("DISCONNECTED");
    expect(result.current.deviceStatuses["1"].state).toBe("CONNECTING");
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.deviceStatuses["1"].state).toBe("DISCONNECTED");
  });

  it.each(["reset", "unmount"])("cancels deferred auto-connect on %s", (action) => {
    const { result, options, unmount } = renderDeviceConnection({ wsConnected: true });
    act(() => {
      result.current.requestDevicesAndStatuses({ autoConnectDeviceIds: ["0", "1"] });
      result.current.updateDeviceStateFromMessage(DEVICE_LIST, "uuid-1");
      if (action === "reset") {
        result.current.resetDeviceState();
      } else {
        unmount();
      }
      vi.runOnlyPendingTimers();
    });
    expect(options.sendWsMessage.mock.calls.map(([command]) => command)).toEqual([
      "/device-list",
      "/status",
    ]);
  });

  it.each(["reset", "unmount"])("clears scheduled retries and connect timeouts on %s", (action) => {
    const { result, options, unmount } = renderDeviceConnection({ wsConnected: true });
    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.updateDeviceStateFromMessage("STATUS id=1 name=USB1 state=CONNECTED");
      result.current.checkDeviceStatusAfterError("USB1", "ERR CONNECTION_LOST removed");
      result.current.connectDevice("0");
    });
    options.sendWsMessage.mockClear();
    act(() => {
      if (action === "reset") {
        result.current.resetDeviceState();
      } else {
        unmount();
      }
      vi.advanceTimersByTime(60_000);
    });
    expect(options.sendWsMessage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores an identity response after its device disconnects", () => {
    const { result } = renderDeviceConnection({ wsConnected: true });
    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.updateDeviceStateFromMessage("STATUS id=1 name=USB1 state=CONNECTED");
      result.current.disconnectDevice("1");
      result.current.updateDeviceStateFromMessage("Acme,PSU,SN,1.0", "uuid-1");
    });
    expect(result.current.deviceStatuses["1"]).toMatchObject({
      state: "DISCONNECTING",
      identity: null,
      reconnecting: false,
    });
  });

  it("forgets pending identity responses on unmount", () => {
    const { result, unmount } = renderDeviceConnection({ wsConnected: true });
    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.updateDeviceStateFromMessage("STATUS id=1 name=USB1 state=CONNECTED");
    });
    const api = result.current;
    const statuses = api.deviceStatusesRef.current;
    unmount();
    act(() => api.updateDeviceStateFromMessage("Acme,PSU,SN,1.0", "uuid-1"));
    expect(api.deviceStatusesRef.current).toBe(statuses);
    expect(api.deviceStatusesRef.current["1"].identity).toBeUndefined();
  });
});
