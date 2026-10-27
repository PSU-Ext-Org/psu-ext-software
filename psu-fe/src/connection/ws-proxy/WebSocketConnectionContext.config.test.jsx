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

describe("WebSocket connection config", () => {
  it("saves connection config to localStorage", async () => {
    renderProvider();
    await updateConfig({
      autoConnect: true,
      deviceAutoConnectIds: ["1"],
      wsScheme: "wss",
      wsHost: "proxy.local",
      wsPort: "9443",
      wsPath: "/ws/scpi",
    });

    await act(async () => {
      connection().saveConfig();
    });

    expect(JSON.parse(localStorage.getItem("psu-fe.config"))).toMatchObject({
      autoConnect: true,
      deviceAutoConnectIds: ["1"],
      wsScheme: "wss",
      wsHost: "proxy.local",
      wsPort: "9443",
      wsPath: "/ws/scpi",
    });
  });

  it("persists auto-connect immediately when toggled", async () => {
    renderProvider();

    await act(async () => {
      connection().updateConfig("autoConnect", true);
    });

    expect(JSON.parse(localStorage.getItem("psu-fe.config"))).toMatchObject({
      autoConnect: true,
      deviceAutoConnectIds: [],
      wsScheme: "ws",
      wsHost: "",
      wsPort: "",
      wsPath: "",
    });
  });

  it("persists per-device auto-connect ids immediately when updated", async () => {
    renderProvider();

    await act(async () => {
      connection().setDeviceAutoConnect("1", true);
    });

    expect(JSON.parse(localStorage.getItem("psu-fe.config"))).toMatchObject({
      autoConnect: false,
      deviceAutoConnectIds: ["1"],
      wsScheme: "ws",
    });
  });

  it("clears connection config and disconnects active transports", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().saveConfig();
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(latestSocket(), "STATUS id=0 name=PSU1 state=CONNECTED transport=tcp");
    });

    expect(screen.getByTestId("ws-connected")).toHaveTextContent("true");
    expect(screen.getByTestId("device-connected")).toHaveTextContent("true");

    await act(async () => {
      connection().clearConnectionConfig();
    });

    expect(localStorage.getItem("psu-fe.config")).toBeNull();
    expect(screen.getByTestId("ws-connected")).toHaveTextContent("false");
    expect(screen.getByTestId("device-connected")).toHaveTextContent("false");
    expect(screen.getByTestId("device-count")).toHaveTextContent("0");
    expect(screen.getByTestId("ws-host")).toHaveTextContent("");
  });
});
