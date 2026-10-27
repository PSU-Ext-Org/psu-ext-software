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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeviceConnection } from "./useDeviceConnection.js";

function renderDeviceConnection(overrides = {}) {
  let nextRequestId = 0;
  const options = {
    sendWsMessage: vi.fn(() => `uuid-${(nextRequestId += 1)}`),
    appendWsMessage: vi.fn(),
    ...overrides,
  };

  return {
    options,
    ...renderHook(() => useDeviceConnection(options)),
  };
}

const DEVICE_LIST = [
  "0,PSU1,TCP,192.168.4.1,5025,",
  "1,USB1,USB,,COM3,115200",
].join("\n");

describe("useDeviceConnection", () => {
  it("clears stored readings for disconnected devices even when their charts are not mounted", () => {
    const { result } = renderDeviceConnection({ wsConnected: true });
    const chartKey = "psu-ext.chart-history.v1";
    const xyKey = "psu-ext.xy-chart-history.v1";
    localStorage.setItem(chartKey, JSON.stringify({ chart: { series: [
      { deviceName: "USB1", points: [{ t: 1, y: 12 }] },
      { deviceName: "PSU1", points: [{ t: 1, y: 5 }] },
    ] } }));
    localStorage.setItem(xyKey, JSON.stringify({
      mixed: { x: { deviceName: "USB1" }, y: { deviceName: "PSU1" }, points: [{ x: 12, y: 5, t: 1 }] },
      healthy: { x: { deviceName: "PSU1" }, y: { deviceName: "PSU1" }, points: [{ x: 5, y: 1, t: 1 }] },
    }));
    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.updateDeviceStateFromMessage("STATUS id=1 name=USB1 state=CONNECTED");
      result.current.checkDeviceStatusAfterError("USB1", "ERR DISCONNECTED removed");
    });
    const saved = JSON.parse(localStorage.getItem(chartKey));
    expect(saved.chart.series[0].points).toEqual([]);
    expect(saved.chart.series[1].points).toHaveLength(1);
    expect(Object.keys(JSON.parse(localStorage.getItem(xyKey)))).toEqual(["healthy"]);
    act(() => result.current.resetDeviceState());
    expect(JSON.parse(localStorage.getItem(chartKey)).chart.series[1].points).toEqual([]);
    expect(JSON.parse(localStorage.getItem(xyKey))).toEqual({});
    localStorage.clear();
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

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests devices and statuses", () => {
    const { result, options } = renderDeviceConnection();

    act(() => {
      result.current.requestDevicesAndStatuses();
    });

    expect(options.sendWsMessage).toHaveBeenNthCalledWith(1, "/device-list");
    expect(options.sendWsMessage).toHaveBeenNthCalledWith(2, "/status");
  });

  it("parses device list and multi-device statuses", () => {
    const { result, options } = renderDeviceConnection();

    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.updateDeviceStateFromMessage(
        [
          "STATUS id=0 name=PSU1 state=CONNECTED transport=tcp host=192.168.4.1 port=5025",
          "STATUS id=1 name=USB1 state=DISCONNECTED",
        ].join("\n"),
      );
    });

    expect(result.current.devices).toHaveLength(2);
    expect(result.current.deviceStatuses["0"].state).toBe("CONNECTED");
    expect(result.current.deviceStatuses["1"].state).toBe("DISCONNECTED");
    expect(result.current.deviceConnected).toBe(true);
    expect(options.sendWsMessage).toHaveBeenCalledWith("CMD PSU1 *IDN?");
  });

  it("connects and disconnects selected devices by id", () => {
    const { result, options } = renderDeviceConnection();

    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.connectDevice("0");
    });

    expect(options.sendWsMessage).toHaveBeenLastCalledWith("/connect PSU1");
    expect(result.current.deviceStatuses["0"].state).toBe("CONNECTING");

    act(() => {
      result.current.updateDeviceStateFromMessage(
        "OK CONNECTED transport=tcp host=192.168.4.1 port=5025",
        "uuid-1",
      );
      result.current.disconnectDevice("0");
    });

    expect(result.current.deviceStatuses["0"].state).toBe("DISCONNECTING");
    expect(options.sendWsMessage).toHaveBeenLastCalledWith("/disconnect PSU1");

    act(() => {
      result.current.updateDeviceStateFromMessage("OK DISCONNECTED", "uuid-3");
    });

    expect(result.current.deviceStatuses["0"].state).toBe("DISCONNECTED");
  });

  it("auto-connects all configured devices after device list loads", () => {
    const { result, options } = renderDeviceConnection();

    act(() => {
      result.current.requestDevicesAndStatuses({ autoConnectDeviceIds: ["0", "1"] });
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      vi.advanceTimersByTime(0);
    });

    expect(options.sendWsMessage).toHaveBeenCalledWith("/connect PSU1");
    expect(options.sendWsMessage).toHaveBeenCalledWith("/connect USB1");
  });

  it("keeps auto-connect pending when a stale disconnected status arrives before OK CONNECTED", () => {
    const { result, options } = renderDeviceConnection();

    act(() => {
      result.current.requestDevicesAndStatuses({ autoConnectDeviceIds: ["1"] });
      result.current.updateDeviceStateFromMessage("1,SIGPSU1,TCP,192.168.0.84,5025,");
      vi.advanceTimersByTime(0);
    });

    expect(options.sendWsMessage).toHaveBeenCalledWith("/connect SIGPSU1");

    act(() => {
      result.current.updateDeviceStateFromMessage(
        "STATUS id=1 name=SIGPSU1 state=DISCONNECTED transport=tcp host=192.168.0.84 port=5025 lastError=Failed to send or receive",
      );
    });

    expect(result.current.deviceStatuses["1"].state).toBe("CONNECTING");

    act(() => {
      result.current.updateDeviceStateFromMessage(
        "OK CONNECTED transport=tcp host=192.168.0.84 port=5025",
        "uuid-3",
      );
    });

    expect(result.current.deviceStatuses["1"].state).toBe("CONNECTED");
    expect(result.current.deviceConnected).toBe(true);
    expect(options.sendWsMessage).toHaveBeenCalledWith("CMD SIGPSU1 *IDN?");
  });

  it("only auto-connects configured device ids after device list loads", () => {
    const { result, options } = renderDeviceConnection();

    act(() => {
      result.current.requestDevicesAndStatuses({ autoConnectDeviceIds: ["1"] });
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      vi.advanceTimersByTime(0);
    });

    expect(options.sendWsMessage).not.toHaveBeenCalledWith("/connect PSU1");
    expect(options.sendWsMessage).toHaveBeenCalledWith("/connect USB1");
  });

  it("stores connect errors on the pending device", () => {
    const { result } = renderDeviceConnection();

    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.connectDevice("0");
      result.current.updateDeviceStateFromMessage("ERR UNSUPPORTED_TRANSPORT nope", "uuid-1");
    });

    expect(result.current.deviceStatuses["0"].state).toBe("DISCONNECTED");
    expect(result.current.deviceStatuses["0"].error).toBe("ERR UNSUPPORTED_TRANSPORT nope");
  });

  it("stores IDN responses on the connected device status", () => {
    const { result } = renderDeviceConnection();

    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.connectDevice("0");
      result.current.updateDeviceStateFromMessage(
        "OK CONNECTED transport=tcp host=192.168.4.1 port=5025",
        "uuid-1",
      );
      result.current.updateDeviceStateFromMessage("Acme Instruments,PSU-EXT,SN001,1.2.3", "uuid-2");
    });

    expect(result.current.deviceStatuses["0"].identity).toMatchObject({
      name: "Acme Instruments PSU-EXT",
      serialNumber: "SN001",
      firmwareLevel: "1.2.3",
      valid: true,
    });
  });

  it("requests identity for a connected USB device", () => {
    const { result, options } = renderDeviceConnection();

    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
      result.current.connectDevice("1");
      result.current.updateDeviceStateFromMessage(
        "OK CONNECTED transport=usb port=COM3 baudrate=115200",
        "uuid-1",
      );
    });

    expect(options.sendWsMessage).toHaveBeenCalledWith("CMD USB1 *IDN?");
  });

  it("clears the device table when requestDevicesAndStatuses is called and an empty response arrives", () => {
    const { result } = renderDeviceConnection();

    act(() => {
      result.current.updateDeviceStateFromMessage(DEVICE_LIST);
    });

    expect(result.current.devices).toHaveLength(2);

    act(() => {
      result.current.requestDevicesAndStatuses();
      result.current.updateDeviceStateFromMessage("", "uuid-1");
    });

    expect(result.current.devices).toHaveLength(0);
  });
});
