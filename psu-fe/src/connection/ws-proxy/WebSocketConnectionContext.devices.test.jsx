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

describe("WebSocket connection devices", () => {
  it("requests device list and statuses when websocket opens", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
    });

    expect(screen.getByTestId("ws-connected")).toHaveTextContent("true");
    expect(sentPayloads(latestSocket())).toEqual(["/device-list", "/status"]);
    expect(screen.getByTestId("messages")).toHaveTextContent(/\[SYSTEM\] OUT \[[^\]]+\] \/device-list/);
    expect(screen.getByTestId("messages")).toHaveTextContent(/\[SYSTEM\] OUT \[[^\]]+\] \/status/);
  });

  it("parses multi-line device list and status responses", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(
        latestSocket(),
        [
          "STATUS id=0 name=PSU1 state=CONNECTED transport=tcp host=192.168.4.1 port=5025",
          "STATUS id=1 name=USB1 state=DISCONNECTED",
        ].join("\n"),
      );
    });

    expect(screen.getByTestId("device-count")).toHaveTextContent("2");
    expect(screen.getByTestId("psu-state")).toHaveTextContent("CONNECTED");
    expect(screen.getByTestId("usb-state")).toHaveTextContent("DISCONNECTED");
    expect(screen.getByTestId("device-connected")).toHaveTextContent("true");
  });

  it("connects and disconnects selected devices by id", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      latestSocket().sent = [];
      connection().connectDevice("0");
    });

    expect(sentPayloads(latestSocket())).toEqual(["/connect PSU1"]);
    expect(screen.getByTestId("psu-state")).toHaveTextContent("CONNECTING");

    await act(async () => {
      receiveWithRequestIndex(latestSocket(), 1, "OK CONNECTED transport=tcp host=192.168.4.1 port=5025");
      connection().disconnectDevice("0");
    });

    expect(sentPayloads(latestSocket())).toEqual([
      "/connect PSU1",
      "CMD PSU1 *IDN?",
      "/disconnect PSU1",
    ]);

    await act(async () => {
      receiveWithRequestIndex(latestSocket(), 3, "OK DISCONNECTED");
    });

    expect(screen.getByTestId("psu-state")).toHaveTextContent("DISCONNECTED");
  });

  it("auto-connects only saved device ids after the proxy opens", async () => {
    localStorage.setItem(
      "psu-fe.config",
      JSON.stringify({
        autoConnect: true,
        deviceAutoConnectIds: ["1"],
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

    expect(sentPayloads(latestSocket())).toEqual([
      "/device-list",
      "/status",
      "/connect USB1",
    ]);
  });
});
