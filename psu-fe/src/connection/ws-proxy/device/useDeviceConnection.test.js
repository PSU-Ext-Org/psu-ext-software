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
