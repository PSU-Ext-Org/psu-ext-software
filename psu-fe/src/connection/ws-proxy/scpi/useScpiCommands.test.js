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
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScpiCommands } from "./useScpiCommands.js";

function renderCommands(overrides = {}) {
  let requestId = 0;
  const options = {
    wsConnected: true,
    wsConnectedRef: { current: true },
    sendWsMessage: vi.fn(() => `request-${++requestId}`),
    appendWsMessage: vi.fn(),
    ...overrides,
  };
  return { options, ...renderHook((props) => useScpiCommands(props), { initialProps: options }) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("awaited SCPI command ownership", () => {
  it("matches responses by UUID while keeping independent timeouts", async () => {
    const { result } = renderCommands();
    const first = result.current.sendScpiCommand("MEAS:VOLT?", "PSU1", { waitForResponse: true });
    const second = result.current.sendScpiCommand("MEAS:CURR?", "PSU1", { waitForResponse: true, timeoutMs: 50 });
    const expired = expect(second).rejects.toThrow("SCPI command timed out.");
    act(() => vi.advanceTimersByTime(50));
    await expired;
    expect(result.current.resolvePendingScpiCommand({ uuid: "request-2", type: "RES", payload: "1" })).toBe(false);
    expect(result.current.resolvePendingScpiCommand({ uuid: "request-1", type: "RES", payload: " 12.0 " })).toBe(true);
    await expect(first).resolves.toEqual({ ok: true, response: "12.0", type: "RES" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["closed", "unmounted"])("rejects pending work when the channel is %s", async (reason) => {
    const { result, options, rerender, unmount } = renderCommands();
    const pending = result.current.sendScpiCommand("MEAS:VOLT?", "PSU1", { waitForResponse: true });
    const rejected = expect(pending).rejects.toThrow("WebSocket command channel closed.");
    if (reason === "closed") {
      rerender({ ...options, wsConnected: false, wsConnectedRef: { current: false } });
    } else {
      unmount();
    }
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.resolvePendingScpiCommand({ uuid: "request-1", type: "RES", payload: "12" })).toBe(false);
  });

  it("releases the timeout when sending fails", async () => {
    const { result } = renderCommands({ sendWsMessage: vi.fn(() => null) });
    await expect(result.current.sendScpiCommand("MEAS:VOLT?", "PSU1", { waitForResponse: true }))
      .rejects.toThrow("SCPI command could not be sent.");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps actions stable while using the latest transport", () => {
    const { result, options, rerender } = renderCommands();
    const send = result.current.sendScpiCommand;
    const resolve = result.current.resolvePendingScpiCommand;
    const nextTransport = vi.fn(() => "next");
    rerender({ ...options, sendWsMessage: nextTransport });
    expect(result.current.sendScpiCommand).toBe(send);
    expect(result.current.resolvePendingScpiCommand).toBe(resolve);
    expect(send("MEAS:VOLT?", "PSU1")).toBe(true);
    expect(nextTransport).toHaveBeenCalledWith("CMD PSU1 MEAS:VOLT?", "USER");
    expect(options.sendWsMessage).not.toHaveBeenCalled();
  });

  it.each(["/connect PSU1", "/disconnect PSU1", ""])("rejects blocked or empty commands: %s", async (command) => {
    const { result, options } = renderCommands();
    expect(result.current.sendScpiCommand(command, "PSU1")).toBe(false);
    await expect(result.current.sendScpiCommand(command, "PSU1", { waitForResponse: true })).rejects.toBeInstanceOf(Error);
    expect(options.sendWsMessage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
