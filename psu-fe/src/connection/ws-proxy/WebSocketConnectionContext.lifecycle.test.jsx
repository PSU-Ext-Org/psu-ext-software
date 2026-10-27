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
  FakeWebSocket,
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

describe("WebSocket connection lifecycle", () => {
  it("opens websocket with configured scheme host port and path", async () => {
    renderProvider();
    await updateConfig({
      wsScheme: "wss",
      wsHost: "proxy.local",
      wsPort: "9443",
      wsPath: "ws/scpi",
    });

    await act(async () => {
      connection().connectWs();
    });

    expect(JSON.parse(localStorage.getItem("psu-fe.config"))).toMatchObject({
      wsScheme: "wss",
      wsHost: "proxy.local",
      wsPort: "9443",
      wsPath: "ws/scpi",
    });
    expect(latestSocket().url).toBe("wss://proxy.local:9443/ws/scpi");
    expect(screen.getByTestId("ws-connecting")).toHaveTextContent("true");
  });

  it("auto-connects once in React StrictMode", async () => {
    localStorage.setItem(
      "psu-fe.config",
      JSON.stringify({
        autoConnect: true,
        wsScheme: "ws",
        wsHost: "localhost",
        wsPort: "8080",
        wsPath: "/ws/scpi",
      }),
    );

    renderProvider({ strict: true });

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(latestSocket().url).toBe("ws://localhost:8080/ws/scpi");
  });

  it("keeps the saved websocket config when the connection errors", async () => {
    renderProvider();
    await updateConfig({
      wsScheme: "wss",
      wsHost: "proxy.local",
      wsPort: "9443",
      wsPath: "/ws/scpi",
    });

    await act(async () => {
      connection().connectWs();
      latestSocket().dispatch("error");
    });

    expect(JSON.parse(localStorage.getItem("psu-fe.config"))).toMatchObject({
      wsScheme: "wss",
      wsHost: "proxy.local",
      wsPort: "9443",
      wsPath: "/ws/scpi",
    });
  });

  it("keeps the saved websocket config when the connection times out", async () => {
    renderProvider();
    await updateConfig({
      wsHost: "timeout.local",
      wsPort: "8080",
      wsPath: "/ws/scpi",
    });

    await act(async () => {
      connection().connectWs();
      vi.advanceTimersByTime(10_000);
    });

    expect(JSON.parse(localStorage.getItem("psu-fe.config"))).toMatchObject({
      wsHost: "timeout.local",
      wsPort: "8080",
      wsPath: "/ws/scpi",
    });
    expect(screen.getByTestId("ws-connected")).toHaveTextContent("false");
  });
});
