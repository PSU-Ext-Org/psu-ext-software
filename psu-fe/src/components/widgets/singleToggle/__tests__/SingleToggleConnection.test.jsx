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
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SingleToggleCard, SingleToggleCardActions } from "../components/SingleToggleCard.jsx";
import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";

const mockConnection = vi.hoisted(() => ({
  wsConnected: true,
  devices: [{ id: "0", name: "PSU1", type: "TCP" }],
  deviceStatuses: { 0: { state: "CONNECTED" } },
  sendScpiCommand: vi.fn(() => Promise.resolve({ ok: true, response: "0" })),
  subscribeScpiSnapshot: vi.fn(() => vi.fn()),
  getScpiQuerySnapshot: vi.fn(() => ({ value: "", updatedAt: 0, loading: false, error: "" })),
}));

vi.mock("../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

describe("SingleToggleCard", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
    mockConnection.wsConnected = true;
    mockConnection.devices = [{ id: "0", name: "PSU1", type: "TCP" }];
    mockConnection.deviceStatuses = { 0: { state: "CONNECTED" } };
    mockConnection.sendScpiCommand.mockReset();
    mockConnection.sendScpiCommand.mockResolvedValue({ ok: true, response: "0" });
    mockConnection.subscribeScpiSnapshot.mockReset();
    mockConnection.subscribeScpiSnapshot.mockReturnValue(vi.fn());
    mockConnection.getScpiQuerySnapshot.mockReset();
    mockConnection.getScpiQuerySnapshot.mockReturnValue({ value: "", updatedAt: 0, loading: false, error: "" });
  });

  it("ignores a late status reply after disconnect and reads fresh status on reconnect", async () => {
    saveConfig("single-toggle-main");
    let resolveStatus;
    mockConnection.sendScpiCommand.mockReturnValueOnce(
      new Promise((resolve) => { resolveStatus = resolve; }),
    );
    const { rerender } = render(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);

    mockConnection.deviceStatuses = { 0: { state: "DISCONNECTED" } };
    rerender(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);
    await act(async () => resolveStatus({ ok: true, response: "1" }));
    expect(screen.queryByText("ON")).not.toBeInTheDocument();
    expect(screen.getByText("--")).toBeInTheDocument();

    mockConnection.deviceStatuses = { 0: { state: "CONNECTED" } };
    mockConnection.sendScpiCommand.mockResolvedValueOnce({ ok: true, response: "0" });
    rerender(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);
    expect(await screen.findByText("OFF")).toBeInTheDocument();
    expect(mockConnection.sendScpiCommand).toHaveBeenCalledTimes(2);
  });

  it("does not verify a delayed write after disconnect", async () => {
    saveConfig("single-toggle-main");
    let resolveWrite;
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockReturnValueOnce(new Promise((resolve) => { resolveWrite = resolve; }));
    const { rerender } = render(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);
    expect(await screen.findByText("OFF")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /turn on/i }));
    await waitFor(() => expect(mockConnection.sendScpiCommand).toHaveBeenCalledTimes(3));
    mockConnection.deviceStatuses = { 0: { state: "DISCONNECTED" } };
    rerender(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);
    await act(async () => resolveWrite({ ok: true, response: "OK SENT" }));
    expect(mockConnection.sendScpiCommand).toHaveBeenCalledTimes(3);
    expect(screen.getByText("--")).toBeInTheDocument();

    mockConnection.deviceStatuses = { 0: { state: "CONNECTED" } };
    mockConnection.sendScpiCommand.mockResolvedValueOnce({ ok: true, response: "1" });
    rerender(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);
    expect(await screen.findByText("ON")).toBeInTheDocument();
    expect(mockConnection.sendScpiCommand).toHaveBeenCalledTimes(4);
  });
});

function saveConfig(widgetId, overrides = {}) {
  window.localStorage.setItem(
    WIDGET_CONFIG_STORAGE_KEY,
    JSON.stringify({
      [widgetId]: {
        type: "singleToggle",
        deviceName: "PSU1",
        statusCommand: "OUTP? CH1",
        onCommand: "OUTP CH1,1",
        offCommand: "OUTP CH1,0",
        onResponse: "1",
        offResponse: "0",
        cardName: "Output",
        statusColor: "#0f766e",
        autoRefreshEnabled: false,
        refreshFrequencyHz: 1,
        ...overrides,
      },
    }),
  );
}
