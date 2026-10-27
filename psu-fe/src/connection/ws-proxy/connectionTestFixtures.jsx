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
import { act, cleanup, render } from "@testing-library/react";
import { StrictMode, useSyncExternalStore } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import {
  useWebSocketConnection,
  WebSocketConnectionProvider,
} from "./WebSocketConnectionContext.jsx";

/** Synchronous socket double with inspectable requests and explicit lifecycle events. */
export class FakeWebSocket {
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

/** Publishes the latest context and subscribes to the monitor for provider assertions. */
export function Probe() {
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

/** Mounts the real provider, optionally exercising React StrictMode startup. */
export function renderProvider({ strict = false } = {}) {
  const tree = (
    <WebSocketConnectionProvider>
      <Probe />
    </WebSocketConnectionProvider>
  );

  render(strict ? (
    <StrictMode>
      {tree}
    </StrictMode>
  ) : tree);

  return window.__connection;
}

/** Returns the latest rendered provider API after state updates. */
export function connection() {
  return window.__connection;
}

/** Returns the most recently constructed socket double. */
export function latestSocket() {
  return FakeWebSocket.instances.at(-1);
}

/** Applies endpoint edits inside React act before a connection attempt. */
export async function updateConfig(values) {
  await act(async () => {
    for (const [key, value] of Object.entries(values)) {
      connection().updateConfig(key, value);
    }
  });
}

/** Registry payload containing independently addressable TCP and USB devices. */
export const DEVICE_LIST = [
  "0,PSU1,TCP,192.168.4.1,5025,",
  "1,USB1,USB,,COM3,115200",
].join("\n");
/** Persisted widget configuration used by the global subscription bridge. */
export const WIDGET_CONFIG_STORAGE_KEY = "psu-ext.widget-configs.v1";
let nextResponseId = 0;

/** Reads raw command payloads from UUID-wrapped outgoing requests. */
export function sentPayloads(socket) {
  return socket.sent.map((message) => parseRequestPayload(message));
}

/** Removes the REQ prefix and UUID from an outgoing wire message. */
export function parseRequestPayload(message) {
  const text = String(message);
  const firstSeparator = text.indexOf(" ");
  const secondSeparator = text.indexOf(" ", firstSeparator + 1);
  return text.substring(secondSeparator + 1);
}

/** Finds the correlation UUID of a request by its one-based send order. */
export function requestUuid(socket, requestIndexFromOne) {
  const text = String(socket.sent[requestIndexFromOne - 1] || "");
  const firstSeparator = text.indexOf(" ");
  const secondSeparator = text.indexOf(" ", firstSeparator + 1);
  return text.substring(firstSeparator + 1, secondSeparator);
}

/** Delivers an unsolicited envelope with a unique UUID. */
export function receivePayload(socket, payload, type = "RES") {
  nextResponseId += 1;
  socket.receive(`${type} recv-${nextResponseId} ${payload}`);
}

/** Replies to a particular outgoing request with its matching UUID. */
export function receiveWithRequestIndex(socket, requestIndexFromOne, payload, type = "RES") {
  socket.receive(`${type} ${requestUuid(socket, requestIndexFromOne)} ${payload}`);
}

/** Installs isolated socket, storage, and timer state for each provider test. */
export function setupConnectionTests() {
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
}
