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
import { describe, expect, it, vi } from "vitest";
import { bindWebSocketEvents } from "./webSocketEvents.js";

function bindEvents() {
  const events = {};
  const socket = { addEventListener: (type, listener) => { events[type] = listener; } };
  const callbacks = {
    wsUrl: "ws://localhost/ws/scpi",
    isCurrent: vi.fn(() => true),
    onOpen: vi.fn(),
    onUnavailable: vi.fn(),
    onClosed: vi.fn(),
    onMessage: vi.fn(),
    appendWsMessage: vi.fn(),
    consumeResponseTag: vi.fn(() => "USER"),
    clearResponseTags: vi.fn(),
  };
  bindWebSocketEvents(socket, callbacks);
  return { events, callbacks };
}

describe("transport event boundary", () => {
  it("delivers envelopes with their UUID and monitor tag", async () => {
    const { events, callbacks } = bindEvents();
    events.open();
    expect(callbacks.onOpen).toHaveBeenCalledOnce();
    await events.message({ data: "RES request-1 12.5" });
    expect(callbacks.onMessage).toHaveBeenCalledWith({ type: "RES", uuid: "request-1", payload: "12.5" }, "USER");
    expect(callbacks.appendWsMessage).toHaveBeenCalledWith("in", "12.5", "USER", "request-1");
    await events.message({ data: "BIN request-2 AA==" });
    expect(callbacks.onMessage).toHaveBeenLastCalledWith({ type: "BIN", uuid: "request-2", payload: "AA==" }, "USER");
    expect(callbacks.appendWsMessage).toHaveBeenLastCalledWith("in", "[binary base64 4 chars]", "USER", "request-2");
  });

  it("logs malformed and unexpected raw binary frames without routing them", async () => {
    const { events, callbacks } = bindEvents();
    await events.message({ data: "unexpected" });
    await events.message({ data: new Uint8Array([1, 2]).buffer });
    expect(callbacks.appendWsMessage).toHaveBeenCalledWith("error", "Malformed WebSocket response envelope: unexpected");
    expect(callbacks.appendWsMessage).toHaveBeenCalledWith("error", "Unexpected raw binary WebSocket response (2 bytes)");
    expect(callbacks.consumeResponseTag).not.toHaveBeenCalled();
    expect(callbacks.onMessage).not.toHaveBeenCalled();
  });

  it.each(["error", "close"])("reports current-socket %s and ignores replaced sockets", (type) => {
    const { events, callbacks } = bindEvents();
    events[type]();
    expect(callbacks.onUnavailable).toHaveBeenCalledOnce();
    expect(callbacks.clearResponseTags).toHaveBeenCalledOnce();
    expect(callbacks.onClosed).toHaveBeenCalledTimes(type === "close" ? 1 : 0);
    callbacks.isCurrent.mockReturnValue(false);
    events[type]();
    expect(callbacks.onUnavailable).toHaveBeenCalledOnce();
    expect(callbacks.clearResponseTags).toHaveBeenCalledOnce();
  });
});
