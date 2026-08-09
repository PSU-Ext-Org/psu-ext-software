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
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useWebSocketConnection,
  WebSocketConnectionProvider,
} from "./WebSocketConnectionContext.jsx";

class FakeWebSocket {
  static instances = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.sent = [];
    this.listeners = {
      open: [],
      message: [],
      close: [],
      error: [],
    };
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type, listener) {
    this.listeners[type].push(listener);
  }

  send(message) {
    this.sent.push(message);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch("close");
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatch("open");
  }

  receive(data) {
    this.dispatch("message", { data });
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners[type]) {
      listener(event);
    }
  }
}

function Probe() {
  const connection = useWebSocketConnection();
  const wsMessages = useSyncExternalStore(
    connection.subscribeWsMessages,
    connection.getWsMessages,
    connection.getWsMessages,
  );
  window.__connection = connection;

  return (
    <div>
      <span data-testid="ws-connected">{String(connection.wsConnected)}</span>
      <span data-testid="ws-connecting">{String(connection.wsConnecting)}</span>
      <span data-testid="device-connected">{String(connection.deviceConnected)}</span>
      <span data-testid="device-connecting">{String(connection.deviceConnecting)}</span>
      <span data-testid="device-count">{connection.devices.length}</span>
      <span data-testid="psu-state">{connection.deviceStatuses["0"]?.state || ""}</span>
      <span data-testid="usb-state">{connection.deviceStatuses["1"]?.state || ""}</span>
      <span data-testid="ws-host">{connection.config.wsHost}</span>
      <pre data-testid="messages">{wsMessages}</pre>
    </div>
  );
}

function renderProvider({ strict = false } = {}) {
  const tree = (
    <WebSocketConnectionProvider>
      <Probe />
    </WebSocketConnectionProvider>
  );

  render(strict ? <StrictMode>{tree}</StrictMode> : tree);

  return window.__connection;
}

function connection() {
  return window.__connection;
}

function latestSocket() {
  return FakeWebSocket.instances.at(-1);
}

async function updateConfig(values) {
  await act(async () => {
    for (const [key, value] of Object.entries(values)) {
      connection().updateConfig(key, value);
    }
  });
}

const DEVICE_LIST = [
  "0,PSU1,TCP,192.168.4.1,5025,",
  "1,USB1,USB,,COM3,115200",
].join("\n");
const WIDGET_CONFIG_STORAGE_KEY = "psu-ext.widget-configs.v1";
let nextResponseId = 0;

describe("WebSocketConnectionProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    FakeWebSocket.instances = [];
    global.WebSocket = FakeWebSocket;
    global.WebSocket.OPEN = FakeWebSocket.OPEN;
    window.__connection = null;
    nextResponseId = 0;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    delete window.__connection;
  });

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

  it("sends SCPI commands through explicit device targeting", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().sendScpiCommand("MEAS:VOLT?", "PSU1");
    });

    expect(screen.getByTestId("messages")).toHaveTextContent(
      "Cannot send SCPI command without a connected target",
    );

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(latestSocket(), "OK STATUS");
      latestSocket().sent = [];
      connection().sendScpiCommand("MEAS:VOLT?", "PSU1");
    });

    expect(sentPayloads(latestSocket())).toEqual(["CMD PSU1 MEAS:VOLT?"]);
    expect(screen.getByTestId("messages")).toHaveTextContent(
      /\[USER\] OUT \[[^\]]+\] CMD PSU1 MEAS:VOLT\?/,
    );
  });

  it("can await SCPI command responses through the monitor command path", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(latestSocket(), "OK STATUS");
      latestSocket().sent = [];
    });

    let commandPromise;
    await act(async () => {
      commandPromise = connection().sendScpiCommand("OUTP? CH1", "PSU1", {
        waitForResponse: true,
      });
    });

    expect(sentPayloads(latestSocket())).toEqual(["CMD PSU1 OUTP? CH1"]);
    expect(screen.getByTestId("messages")).toHaveTextContent(
      /\[USER\] OUT \[[^\]]+\] CMD PSU1 OUTP\? CH1/,
    );

    await act(async () => {
      receiveWithRequestIndex(latestSocket(), 1, "1");
    });

    await expect(commandPromise).resolves.toEqual({ ok: true, response: "1", type: "RES" });
    expect(connection().getScpiQuerySnapshot("PSU1", "OUTP? CH1").value).toBe("");
  });

  it("can await binary SCPI command responses without timing out", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(latestSocket(), "STATUS id=0 name=PSU1 state=CONNECTED transport=tcp");
      latestSocket().sent = [];
    });

    let commandPromise;
    await act(async () => {
      commandPromise = connection().sendScpiCommand("MEAS:VOLT:DATA? CH1", "PSU1", {
        waitForResponse: true,
      });
    });

    expect(sentPayloads(latestSocket())).toEqual(["CMD PSU1 MEAS:VOLT:DATA? CH1"]);

    await act(async () => {
      receiveWithRequestIndex(latestSocket(), 1, "IzE0AQIDBA==", "BIN");
    });

    await expect(commandPromise).resolves.toEqual({
      ok: true,
      response: "IzE0AQIDBA==",
      type: "BIN",
    });
  });

  it("rejects awaited SCPI command promises for error responses", async () => {
    renderProvider();
    await updateConfig({ wsHost: "localhost", wsPort: "8080", wsPath: "/ws/scpi" });

    await act(async () => {
      connection().connectWs();
      latestSocket().open();
      receivePayload(latestSocket(), DEVICE_LIST);
      receivePayload(latestSocket(), "OK STATUS");
    });

    let commandErrorPromise;
    await act(async () => {
      const commandPromise = connection().sendScpiCommand("OUTP? CH1", "PSU1", {
        waitForResponse: true,
      });
      commandErrorPromise = commandPromise.catch((error) => error);
      receiveWithRequestIndex(latestSocket(), 3, "ERR TIMEOUT No response");
    });

    await expect(commandErrorPromise).resolves.toEqual(expect.any(Error));
    await expect(commandErrorPromise).resolves.toMatchObject({
      message: "ERR TIMEOUT No response",
    });
  });

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

function sentPayloads(socket) {
  return socket.sent.map((message) => parseRequestPayload(message));
}

function parseRequestPayload(message) {
  const text = String(message);
  const firstSeparator = text.indexOf(" ");
  const secondSeparator = text.indexOf(" ", firstSeparator + 1);
  return text.substring(secondSeparator + 1);
}

function requestUuid(socket, requestIndexFromOne) {
  const text = String(socket.sent[requestIndexFromOne - 1] || "");
  const firstSeparator = text.indexOf(" ");
  const secondSeparator = text.indexOf(" ", firstSeparator + 1);
  return text.substring(firstSeparator + 1, secondSeparator);
}

function receivePayload(socket, payload, type = "RES") {
  nextResponseId += 1;
  socket.receive(`${type} recv-${nextResponseId} ${payload}`);
}

function receiveWithRequestIndex(socket, requestIndexFromOne, payload, type = "RES") {
  socket.receive(`${type} ${requestUuid(socket, requestIndexFromOne)} ${payload}`);
}
