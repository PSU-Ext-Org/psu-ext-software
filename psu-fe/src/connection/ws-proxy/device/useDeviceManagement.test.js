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
import { useDeviceManagement } from "./useDeviceManagement.js";

function renderDeviceManagement(overrides = {}) {
  let nextRequestId = 0;
  const options = {
    sendWsMessage: vi.fn(() => `uuid-${(nextRequestId += 1)}`),
    onRefresh: vi.fn(),
    ...overrides,
  };
  return {
    options,
    ...renderHook(() => useDeviceManagement(options)),
  };
}

describe("useDeviceManagement", () => {
  it("addDevice sends the correct command and resolves on success", async () => {
    const { result, options } = renderDeviceManagement();
    let resolved = false;

    await act(async () => {
      const promise = result.current.addDevice({
        name: "PSU2",
        type: "TCP",
        ip: "192.168.1.2",
        port: "5025",
        baudrate: "",
      });
      result.current.updateDeviceManagementFromMessage("OK DEVICE_ADDED 2,PSU2,TCP,192.168.1.2,5025,", "uuid-1");
      await promise;
      resolved = true;
    });

    expect(options.sendWsMessage).toHaveBeenCalledWith("/device-add PSU2,TCP,192.168.1.2,5025,");
    expect(resolved).toBe(true);
    expect(options.onRefresh).toHaveBeenCalledOnce();
  });

  it("addDevice rejects when the backend returns an error", async () => {
    const { result, options } = renderDeviceManagement();
    let rejection = "";

    await act(async () => {
      const promise = result.current
        .addDevice({ name: "PSU1", type: "TCP", ip: "192.168.1.1", port: "5025", baudrate: "" })
        .catch((err) => { rejection = err; });
      result.current.updateDeviceManagementFromMessage("ERR DUPLICATE_NAME", "uuid-1");
      await promise;
    });

    expect(rejection).toBe("ERR DUPLICATE_NAME");
    expect(options.onRefresh).not.toHaveBeenCalled();
  });

  it("modifyDevice sends key=value fields and resolves on success", async () => {
    const { result, options } = renderDeviceManagement();
    let resolved = false;

    await act(async () => {
      const promise = result.current.modifyDevice("0", {
        name: "PSU1",
        type: "TCP",
        ip: "10.0.0.1",
        port: "5025",
        baudrate: "",
      });
      result.current.updateDeviceManagementFromMessage("OK DEVICE_MODIFIED 0,PSU1,TCP,10.0.0.1,5025,", "uuid-1");
      await promise;
      resolved = true;
    });

    expect(options.sendWsMessage).toHaveBeenCalledWith(
      "/device-modify 0,name=PSU1,type=TCP,ip=10.0.0.1,port=5025,baudrate=",
    );
    expect(resolved).toBe(true);
    expect(options.onRefresh).toHaveBeenCalledOnce();
  });

  it("modifyDevice rejects when the backend returns an error", async () => {
    const { result, options } = renderDeviceManagement();
    let rejection = "";

    await act(async () => {
      const promise = result.current
        .modifyDevice("0", { name: "PSU1", type: "TCP", ip: "", port: "5025", baudrate: "" })
        .catch((err) => { rejection = err; });
      result.current.updateDeviceManagementFromMessage("ERR BAD_IP", "uuid-1");
      await promise;
    });

    expect(rejection).toBe("ERR BAD_IP");
    expect(options.onRefresh).not.toHaveBeenCalled();
  });

  it("deleteDevice sends the device id and resolves on success", async () => {
    const { result, options } = renderDeviceManagement();
    let resolved = false;

    await act(async () => {
      const promise = result.current.deleteDevice("0");
      result.current.updateDeviceManagementFromMessage("OK DEVICE_DELETED 0", "uuid-1");
      await promise;
      resolved = true;
    });

    expect(options.sendWsMessage).toHaveBeenCalledWith("/device-delete 0");
    expect(resolved).toBe(true);
    expect(options.onRefresh).toHaveBeenCalledOnce();
  });

  it("deleteDevice rejects when the backend returns an error", async () => {
    const { result, options } = renderDeviceManagement();
    let rejection = "";

    await act(async () => {
      const promise = result.current
        .deleteDevice("0")
        .catch((err) => { rejection = err; });
      result.current.updateDeviceManagementFromMessage("ERR DEVICE_NOT_FOUND", "uuid-1");
      await promise;
    });

    expect(rejection).toBe("ERR DEVICE_NOT_FOUND");
    expect(options.onRefresh).not.toHaveBeenCalled();
  });

  it("updateDeviceManagementFromMessage returns false for unrelated messages", () => {
    const { result } = renderDeviceManagement();
    let handled;

    act(() => {
      handled = result.current.updateDeviceManagementFromMessage("OK CONNECTED transport=tcp", "uuid-99");
    });

    expect(handled).toBe(false);
  });

  it("resetDeviceManagement drops all pending promises", async () => {
    const { result, options } = renderDeviceManagement();
    let resolved = false;

    await act(async () => {
      result.current.addDevice({ name: "PSU1", type: "TCP", ip: "1.2.3.4", port: "5025", baudrate: "" });
      result.current.resetDeviceManagement();
      result.current.updateDeviceManagementFromMessage("OK DEVICE_ADDED 1,PSU1,TCP,1.2.3.4,5025,", "uuid-1");
      resolved = true;
    });

    expect(options.onRefresh).not.toHaveBeenCalled();
    expect(resolved).toBe(true);
  });
});
