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

describe("device recovery and status checks", () => {
  it("keeps recovery attempts independent when one device recovers first", () => {
    const { result, options } = renderDeviceConnection({ wsConnected: true });
    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.updateDeviceStateFromMessage([
        "STATUS id=0 name=PSU1 state=CONNECTED",
        "STATUS id=1 name=USB1 state=CONNECTED",
      ].join("\n"));
      result.current.checkDeviceStatusAfterError("PSU1", "ERR DISCONNECTED lost");
      result.current.checkDeviceStatusAfterError("USB1", "ERR DISCONNECTED lost");
    });
    act(() => vi.advanceTimersByTime(2000));
    act(() => {
      result.current.updateDeviceStateFromMessage("OK CONNECTED", "uuid-3");
      result.current.updateDeviceStateFromMessage("ERR CONNECT_FAILED absent", "uuid-4");
    });
    act(() => vi.advanceTimersByTime(5000));
    const commands = options.sendWsMessage.mock.calls.map(([command]) => command);
    expect(commands.filter((command) => command === "/connect PSU1")).toHaveLength(1);
    expect(commands.filter((command) => command === "/connect USB1")).toHaveLength(2);
    expect(result.current.deviceStatuses["0"]).toMatchObject({ state: "CONNECTED", reconnecting: false });
    expect(result.current.deviceStatuses["1"]).toMatchObject({ state: "CONNECTING", reconnecting: true });
  });

  it("coalesces status checks until the response arrives or ten seconds elapse", () => {
    const { result, options } = renderDeviceConnection({ wsConnected: true });
    act(() => {
      result.current.checkDeviceStatusAfterError();
      vi.advanceTimersByTime(9999);
      result.current.checkDeviceStatusAfterError();
    });
    expect(options.sendWsMessage).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1);
      result.current.checkDeviceStatusAfterError();
      result.current.updateDeviceStateFromMessage("", "uuid-2");
      result.current.checkDeviceStatusAfterError();
    });
    expect(options.sendWsMessage).toHaveBeenCalledTimes(3);
  });

  it.each([false, true])("stops after three delayed recovery attempts (timeout=%s)", (timeout) => {
    const { result, options } = renderDeviceConnection({ wsConnected: true });
    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.updateDeviceStateFromMessage("STATUS id=1 name=USB1 state=CONNECTED");
      result.current.checkDeviceStatusAfterError("USB1", "ERR DISCONNECTED USB transport is not connected");
    });
    const connects = () => options.sendWsMessage.mock.calls.filter(([cmd]) => cmd === "/connect USB1").length;
    for (const [index, delay] of [2000, 5000, 15000].entries()) {
      act(() => vi.advanceTimersByTime(delay - 1));
      expect(connects()).toBe(index);
      act(() => vi.advanceTimersByTime(1));
      expect(connects()).toBe(index + 1);
      expect(result.current.deviceStatuses["1"].reconnecting).toBe(true);
      if (timeout) {
        act(() => vi.advanceTimersByTime(9999));
        expect(result.current.deviceStatuses["1"].state).toBe("CONNECTING");
        act(() => vi.advanceTimersByTime(1));
      } else {
        act(() => result.current.updateDeviceStateFromMessage("ERR CONNECT_FAILED absent", `uuid-${index + 2}`));
      }
    }
    expect(result.current.deviceStatuses["1"]).toMatchObject({ state: "DISCONNECTED", reconnecting: false });
    act(() => vi.advanceTimersByTime(60000));
    expect(connects()).toBe(3);
    act(() => result.current.connectDevice("1"));
    expect(connects()).toBe(4);
  });

  it.each([false, true])("cancels recovery and ignores late connect replies (in flight=%s)", (inFlight) => {
    const { result, options } = renderDeviceConnection({ wsConnected: true });
    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.updateDeviceStateFromMessage("STATUS id=1 name=USB1 state=CONNECTED");
      result.current.checkDeviceStatusAfterError("USB1", "ERR CONNECTION_LOST removed");
    });
    if (inFlight) act(() => vi.advanceTimersByTime(2000));
    act(() => result.current.disconnectDevice("1"));
    expect(result.current.deviceStatuses["1"].reconnecting).toBe(false);
    expect(result.current.deviceConnectingIds).toEqual([]);
    act(() => {
      if (inFlight) result.current.updateDeviceStateFromMessage("OK CONNECTED transport=usb", "uuid-2");
      result.current.updateDeviceStateFromMessage("OK DISCONNECTED", inFlight ? "uuid-3" : "uuid-2");
      vi.advanceTimersByTime(60000);
    });
    expect(result.current.deviceStatuses["1"].state).toBe("DISCONNECTED");
    expect(options.sendWsMessage.mock.calls.filter(([cmd]) => cmd === "/connect USB1")).toHaveLength(inFlight ? 1 : 0);
  });

  it("checks status only after errors, recovers USB loss, and honors manual disconnect", () => {
    const { result, options, unmount } = renderDeviceConnection({ wsConnected: true });
    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.updateDeviceStateFromMessage("STATUS id=1 name=USB1 state=CONNECTED");
      result.current.updateDeviceStateFromMessage("Acme,PSU,SN1,1.0", "uuid-1");
    });
    act(() => vi.advanceTimersByTime(12000));
    expect(options.sendWsMessage).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.checkDeviceStatusAfterError();
      result.current.checkDeviceStatusAfterError();
    });
    expect(options.sendWsMessage).toHaveBeenCalledTimes(2);
    expect(options.sendWsMessage).toHaveBeenLastCalledWith("/status");
    act(() => {
      result.current.updateDeviceStateFromMessage("STATUS id=1 name=USB1 state=DISCONNECTED", "uuid-2");
    });
    expect(result.current.deviceStatuses["1"].identity).toBeNull();
    expect(result.current.deviceStatuses["1"].reconnecting).toBe(true);
    expect(result.current.deviceConnected).toBe(false);
    act(() => vi.advanceTimersByTime(2000));
    expect(options.sendWsMessage).toHaveBeenCalledWith("/connect USB1");
    expect(options.sendWsMessage).toHaveBeenLastCalledWith("/connect USB1");
    expect(result.current.deviceStatuses["1"].reconnecting).toBe(true);
    act(() => {
      result.current.updateDeviceStateFromMessage("ERR CONNECT_FAILED missing port", "uuid-3");
    });
    expect(result.current.deviceStatuses["1"].reconnecting).toBe(true);
    act(() => {
      vi.advanceTimersByTime(5000);
      result.current.updateDeviceStateFromMessage("OK CONNECTED transport=usb", "uuid-4");
    });
    expect(result.current.deviceStatuses["1"].state).toBe("CONNECTED");
    expect(result.current.deviceStatuses["1"].reconnecting).toBe(false);
    expect(options.sendWsMessage.mock.calls.filter(([cmd]) => cmd === "CMD USB1 *IDN?")).toHaveLength(2);
    act(() => {
      result.current.disconnectDevice("1");
      result.current.updateDeviceStateFromMessage("OK DISCONNECTED", "uuid-6");
    });
    expect(result.current.deviceStatuses["1"].reconnecting).toBe(false);
    options.sendWsMessage.mockClear();
    act(() => vi.advanceTimersByTime(12000));
    expect(options.sendWsMessage).not.toHaveBeenCalledWith("/connect USB1");
    unmount();
    options.sendWsMessage.mockClear();
    act(() => vi.advanceTimersByTime(12000));
    expect(options.sendWsMessage).not.toHaveBeenCalled();
  });

  it("does not reconnect when an error-triggered status check reports a healthy device", () => {
    const { result, options } = renderDeviceConnection({ wsConnected: true });
    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.updateDeviceStateFromMessage("STATUS id=1 name=USB1 state=CONNECTED");
      result.current.checkDeviceStatusAfterError();
      result.current.updateDeviceStateFromMessage("STATUS id=1 name=USB1 state=CONNECTED", "uuid-2");
    });
    options.sendWsMessage.mockClear();
    act(() => vi.advanceTimersByTime(12000));
    expect(result.current.deviceStatuses["1"].state).toBe("CONNECTED");
    expect(options.sendWsMessage).not.toHaveBeenCalled();
  });
});
