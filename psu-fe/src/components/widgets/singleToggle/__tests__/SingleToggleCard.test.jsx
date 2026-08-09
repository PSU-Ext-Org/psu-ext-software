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
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("renders unconfigured state", () => {
    render(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);

    expect(screen.getByText("Configure a target device and toggle commands.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure" })).toBeInTheDocument();
  });

  it("saves settings under the placement id", () => {
    render(<SingleToggleCardActions placement={{ id: "single-toggle-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure single toggle card" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("Status command"), { target: { value: "OUTP? CH1" } });
    fireEvent.change(screen.getByLabelText("On command"), { target: { value: "OUTP CH1,1" } });
    fireEvent.change(screen.getByLabelText("Off command"), { target: { value: "OUTP CH1,0" } });
    fireEvent.change(screen.getByLabelText("On response"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Off response"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Card name"), { target: { value: "Output" } });
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "#dc2626" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))).toMatchObject({
      "single-toggle-main": {
        type: "singleToggle",
        deviceName: "PSU1",
        statusCommand: "OUTP? CH1",
        onCommand: "OUTP CH1,1",
        offCommand: "OUTP CH1,0",
        onResponse: "1",
        offResponse: "0",
        cardName: "Output",
        statusColor: "#dc2626",
        autoRefreshEnabled: false,
        refreshFrequencyHz: 1,
      },
    });
  });

  it("checks status on mount", async () => {
    saveConfig("single-toggle-main");
    mockConnection.sendScpiCommand.mockResolvedValueOnce({ ok: true, response: "1" });

    render(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);

    expect(await screen.findByText("ON")).toBeInTheDocument();
    expect(mockConnection.sendScpiCommand).toHaveBeenCalledWith("OUTP? CH1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
    expect(mockConnection.subscribeScpiSnapshot).toHaveBeenCalledWith("PSU1", "OUTP? CH1", expect.any(Function));
    expect(screen.getByText("ON")).toHaveStyle({
      color: "#0f766e",
    });
  });

  it("dedupes automatic status checks during StrictMode remount", async () => {
    saveConfig("single-toggle-main");
    let resolveStatus;
    mockConnection.sendScpiCommand.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStatus = resolve;
      }),
    );

    render(
      <StrictMode>
        <SingleToggleCard placement={{ id: "single-toggle-main" }} />
      </StrictMode>,
    );

    expect(mockConnection.sendScpiCommand).toHaveBeenCalledTimes(1);
    resolveStatus({ ok: true, response: "1" });
    expect(await screen.findByText("ON")).toBeInTheDocument();
  });

  it("runs pre-check, on command, and verification for off-to-on flow", async () => {
    saveConfig("single-toggle-main");
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "OK SENT" })
      .mockResolvedValueOnce({ ok: true, response: "1" });

    render(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);
    expect(await screen.findByText("OFF")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /turn on/i }));

    await waitFor(() => expect(screen.getByText("ON")).toBeInTheDocument());
    expect(mockConnection.sendScpiCommand).toHaveBeenNthCalledWith(1, "OUTP? CH1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
    expect(mockConnection.sendScpiCommand).toHaveBeenNthCalledWith(2, "OUTP? CH1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
    expect(mockConnection.sendScpiCommand).toHaveBeenNthCalledWith(3, "OUTP CH1,1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
    expect(mockConnection.sendScpiCommand).toHaveBeenNthCalledWith(4, "OUTP? CH1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
  });

  it("skips the on command when pre-check already reports on", async () => {
    saveConfig("single-toggle-main");
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "1" });

    render(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);
    expect(await screen.findByText("OFF")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /turn on/i }));

    await waitFor(() => expect(screen.getByText("ON")).toBeInTheDocument());
    expect(mockConnection.sendScpiCommand).toHaveBeenCalledTimes(2);
    expect(mockConnection.sendScpiCommand).not.toHaveBeenCalledWith("OUTP CH1,1", "PSU1", {
      tag: "GUI",
      waitForResponse: true,
    });
  });

  it("shows verification failure when final status does not match target", async () => {
    saveConfig("single-toggle-main");
    mockConnection.sendScpiCommand
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "0" })
      .mockResolvedValueOnce({ ok: true, response: "OK SENT" })
      .mockResolvedValueOnce({ ok: true, response: "0" });

    render(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);
    expect(await screen.findByText("OFF")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /turn on/i }));

    expect(await screen.findByText("Verification failed: expected ON.")).toBeInTheDocument();
  });

  it("saves optional auto refresh settings", () => {
    render(<SingleToggleCardActions placement={{ id: "single-toggle-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure single toggle card" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("Status command"), { target: { value: "OUTP? CH1" } });
    fireEvent.change(screen.getByLabelText("On command"), { target: { value: "OUTP CH1,1" } });
    fireEvent.change(screen.getByLabelText("Off command"), { target: { value: "OUTP CH1,0" } });
    fireEvent.click(screen.getByLabelText("Optional status refresh"));
    fireEvent.change(screen.getByLabelText("Frequency (Hz)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))).toMatchObject({
      "single-toggle-main": {
        autoRefreshEnabled: true,
        refreshFrequencyHz: 5,
      },
    });
  });

  it("keeps refresh frequency visible but disabled while auto refresh is off", () => {
    render(<SingleToggleCardActions placement={{ id: "single-toggle-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure single toggle card" }));

    expect(screen.getByLabelText("Frequency (Hz)")).toBeDisabled();
  });

  it("blocks save for invalid refresh frequency only when auto refresh is enabled", () => {
    render(<SingleToggleCardActions placement={{ id: "single-toggle-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure single toggle card" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("Status command"), { target: { value: "OUTP? CH1" } });
    fireEvent.change(screen.getByLabelText("On command"), { target: { value: "OUTP CH1,1" } });
    fireEvent.change(screen.getByLabelText("Off command"), { target: { value: "OUTP CH1,0" } });

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

    fireEvent.click(screen.getByLabelText("Optional status refresh"));
    fireEvent.change(screen.getByLabelText("Frequency (Hz)"), { target: { value: "0.01" } });

    expect(screen.getByText("Frequency must be between 0.1 Hz and 100 Hz.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("updates state from scheduler snapshots when auto refresh is enabled", async () => {
    saveConfig("single-toggle-main", { autoRefreshEnabled: true, refreshFrequencyHz: 2 });
    mockConnection.sendScpiCommand.mockResolvedValueOnce({ ok: true, response: "0" });
    mockConnection.getScpiQuerySnapshot.mockImplementation(() => ({
      value: "1",
      updatedAt: 123,
      loading: false,
      error: "",
    }));

    render(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);

    expect(await screen.findByText("ON")).toBeInTheDocument();
  });

  it("shows scheduler errors when auto refresh is enabled", async () => {
    saveConfig("single-toggle-main", { autoRefreshEnabled: true, refreshFrequencyHz: 2 });
    mockConnection.sendScpiCommand.mockResolvedValueOnce({ ok: true, response: "0" });
    mockConnection.getScpiQuerySnapshot.mockImplementation(() => ({
      value: "",
      updatedAt: 0,
      loading: false,
      error: "ERR TIMEOUT No response",
    }));

    render(<SingleToggleCard placement={{ id: "single-toggle-main" }} />);

    expect(await screen.findByText("ERR TIMEOUT No response")).toBeInTheDocument();
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
