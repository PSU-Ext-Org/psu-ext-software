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

describe("WebSocket connection routing", () => {
  it("does not let scheduler steal non-scheduler inbound responses", async () => {
    localStorage.setItem(
      WIDGET_CONFIG_STORAGE_KEY,
      JSON.stringify({
        "single-value-home-main": {
          type: "singleValue",
          deviceName: "PSU1",
          query: "MEAS:VOLT?",
          frequencyHz: 10,
          unit: "V",
          cardName: "Voltage",
          valueColor: "#2563eb",
        },
      }),
    );
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(latestSocket(), "STATUS id=0 name=PSU1 state=CONNECTED transport=tcp");
      vi.advanceTimersByTime(100);
      receiveWithRequestIndex(latestSocket(), 3, "ACME,PSU,SN01,1.0");
    });

    expect(connection().deviceStatuses["0"].identity).toMatchObject({
      raw: "ACME,PSU,SN01,1.0",
      valid: true,
    });
    expect(connection().getScpiQuerySnapshot("PSU1", "MEAS:VOLT?").value).toBe("");
  });

  it("only auto-connects the saved proxy after saved websocket config opens", async () => {
    localStorage.setItem(
      "psu-fe.config",
      JSON.stringify({
        autoConnect: true,
        deviceAutoConnectIds: [],
        wsScheme: "ws",
        wsHost: "localhost",
        wsPort: "8080",
        wsPath: "/ws/scpi",
      }),
    );

    renderProvider();
    await act(async () => {
      vi.advanceTimersByTime(0);
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      vi.advanceTimersByTime(0);
    });

    expect(sentPayloads(latestSocket())).toEqual(["/device-list", "/status"]);
  });
});
