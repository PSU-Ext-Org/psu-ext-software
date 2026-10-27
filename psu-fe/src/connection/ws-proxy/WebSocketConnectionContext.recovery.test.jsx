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
import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  renderProvider,
  connection,
  latestSocket,
  updateConfig,
  DEVICE_LIST,
  WIDGET_CONFIG_STORAGE_KEY,
  sentPayloads,
  parseRequestPayload,
  requestUuid,
  receivePayload,
  receiveWithRequestIndex,
  setupConnectionTests,
} from "./connectionTestFixtures.jsx";

setupConnectionTests();

describe("WebSocket connection recovery", () => {
  it("handles USB scheduler disconnects immediately and recovers without a status round trip", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });
    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(latestSocket(), [
        "STATUS id=0 name=PSU1 state=CONNECTED",
        "STATUS id=1 name=USB1 state=CONNECTED",
      ].join("\n"));
    });
    const socket = latestSocket();
    socket.sent = [];
    await act(async () => {
      for (const [widgetId, deviceName, query] of [
        ["usb-voltage", "USB1", "MEAS:VOLT?"],
        ["usb-current", "USB1", "MEAS:CURR?"],
        ["tcp-voltage", "PSU1", "MEAS:VOLT?"],
      ]) {
        connection().subscribeScpiQuery({ widgetId, deviceName, query, frequencyHz: 10 });
      }
    });
    const lateUuid = requestUuid(socket, 2);
    await act(async () => {
      receiveWithRequestIndex(socket, 1, "ERR DISCONNECTED USB transport is not connected");
      // Simulate another queued response and a scheduler tick before React's effects run.
      receiveWithRequestIndex(socket, 2, "ERR DISCONNECTED USB transport is not connected");
      receiveWithRequestIndex(socket, 3, "12.5");
      vi.advanceTimersByTime(100);
    });
    expect(connection().deviceStatuses["1"].state).toBe("DISCONNECTED");
    expect(connection().deviceStatuses["0"].state).toBe("CONNECTED");
    expect(connection().getScpiQuerySnapshot("USB1", "MEAS:VOLT?")).toMatchObject({
      value: "", error: "", loading: false,
    });
    expect(connection().getScpiQuerySnapshot("USB1", "MEAS:CURR?")).toMatchObject({
      value: "", error: "", loading: false,
    });
    expect(connection().getScpiQuerySnapshot("PSU1", "MEAS:VOLT?").value).toBe("12.5");
    expect(sentPayloads(socket).filter((payload) => payload.startsWith("CMD USB1"))).toHaveLength(2);
    expect(sentPayloads(socket)).not.toContain("/status");
    await act(async () => vi.advanceTimersByTime(2000));
    const connectIndex = sentPayloads(socket).indexOf("/connect USB1") + 1;
    expect(connectIndex).toBeGreaterThan(0);
    await act(async () => receiveWithRequestIndex(socket, connectIndex, "OK CONNECTED transport=usb"));
    expect(connection().deviceStatuses["1"].state).toBe("CONNECTED");
    const voltageIndex = sentPayloads(socket).lastIndexOf("CMD USB1 MEAS:VOLT?") + 1;
    expect(voltageIndex).toBeGreaterThan(connectIndex);
    await act(async () => {
      socket.receive(`RES ${lateUuid} ERR DISCONNECTED USB transport is not connected`);
      receiveWithRequestIndex(socket, voltageIndex, "5.0");
    });
    expect(connection().deviceStatuses["1"].state).toBe("CONNECTED");
    expect(connection().getScpiQuerySnapshot("USB1", "MEAS:VOLT?")).toMatchObject({
      value: "5.0", error: "", loading: false,
    });
  });
});
