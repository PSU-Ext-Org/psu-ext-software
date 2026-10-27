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

describe("WebSocket connection subscriptions", () => {
  it("runs saved SingleValueCard scheduler subscriptions globally", async () => {
    localStorage.setItem(
      WIDGET_CONFIG_STORAGE_KEY,
      JSON.stringify({
        "single-value-home-main": {
          type: "singleValue",
          deviceName: "PSU1",
          query: "MEAS:VOLT? CH1",
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
      latestSocket().sent = [];
      vi.advanceTimersByTime(100);
    });

    expect(sentPayloads(latestSocket())).toContain("CMD PSU1 MEAS:VOLT? CH1");
    expect(screen.getByTestId("messages")).toHaveTextContent(
      /\[SCHEDULER\] OUT \[[^\]]+\] CMD PSU1 MEAS:VOLT\? CH1/,
    );
  });

  it("runs saved ChartCard series scheduler subscriptions globally", async () => {
    localStorage.setItem(
      WIDGET_CONFIG_STORAGE_KEY,
      JSON.stringify({
        "chart-home-main": {
          type: "chart",
          cardName: "Voltage Trend",
          unit: "V",
          frequencyHz: 10,
          series: [
            {
              id: "voltage",
              label: "Voltage",
              deviceName: "PSU1",
              query: "MEAS:VOLT? CH1",
              lineColor: "#2563eb",
            },
          ],
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
      latestSocket().sent = [];
      vi.advanceTimersByTime(100);
    });

    expect(sentPayloads(latestSocket())).toContain("CMD PSU1 MEAS:VOLT? CH1");
    expect(screen.getByTestId("messages")).toHaveTextContent(
      /\[SCHEDULER\] OUT \[[^\]]+\] CMD PSU1 MEAS:VOLT\? CH1/,
    );
  });

  it("shares one scheduler request for matching SingleValueCard and ChartCard queries", async () => {
    localStorage.setItem(
      WIDGET_CONFIG_STORAGE_KEY,
      JSON.stringify({
        "single-value-home-main": {
          type: "singleValue",
          deviceName: "PSU1",
          query: "MEAS:VOLT? CH1",
          frequencyHz: 1,
          unit: "V",
          cardName: "Voltage",
          valueColor: "#2563eb",
        },
        "chart-home-main": {
          type: "chart",
          cardName: "Voltage Trend",
          unit: "V",
          frequencyHz: 10,
          series: [
            {
              id: "voltage",
              label: "Voltage",
              deviceName: "PSU1",
              query: "MEAS:VOLT?   CH1",
              lineColor: "#2563eb",
            },
          ],
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
      latestSocket().sent = [];
      vi.advanceTimersByTime(100);
    });

    expect(
      sentPayloads(latestSocket()).filter((message) => message === "CMD PSU1 MEAS:VOLT? CH1"),
    ).toHaveLength(1);
  });
});
