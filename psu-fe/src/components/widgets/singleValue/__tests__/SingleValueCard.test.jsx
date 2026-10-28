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
import { afterEach, describe, expect, it, vi } from "vitest";
import { SingleValueCard, SingleValueCardActions } from "../components/SingleValueCard.jsx";
import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";

const mockConnection = vi.hoisted(() => ({
  sendScpiCommand: vi.fn().mockResolvedValue({ ok: true }),
  refreshScpiQuery: vi.fn(() => true),
  wsConnected: true,
  devices: [{ id: "0", name: "PSU1", type: "TCP" }],
  deviceStatuses: { 0: { state: "CONNECTED" } },
  subscribeScpiQuery: vi.fn(() => vi.fn()),
  subscribeScpiSnapshot: vi.fn(() => vi.fn()),
  getScpiQuerySnapshot: vi.fn(() => ({
    value: "12.04",
    updatedAt: 100,
    loading: false,
    error: "",
  })),
}));

vi.mock("../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

describe("SingleValueCard", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
    mockConnection.sendScpiCommand.mockReset();
    mockConnection.sendScpiCommand.mockResolvedValue({ ok: true });
    mockConnection.refreshScpiQuery.mockReset();
    mockConnection.refreshScpiQuery.mockReturnValue(true);

    mockConnection.wsConnected = true;
    mockConnection.devices = [{ id: "0", name: "PSU1", type: "TCP" }];
    mockConnection.deviceStatuses = { 0: { state: "CONNECTED" } };
    mockConnection.subscribeScpiQuery.mockReset();
    mockConnection.subscribeScpiQuery.mockReturnValue(vi.fn());
    mockConnection.subscribeScpiSnapshot.mockReset();
    mockConnection.subscribeScpiSnapshot.mockReturnValue(vi.fn());
    mockConnection.getScpiQuerySnapshot.mockReset();
    mockConnection.getScpiQuerySnapshot.mockReturnValue({
      value: "12.04",
      updatedAt: 100,
      loading: false,
      error: "",
    });
  });

  it("renders cached value, unit, and selected color", () => {
    window.localStorage.setItem(
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
      }),
    );

    render(<SingleValueCard placement={{ id: "single-value-home-main" }} />);

    expect(screen.getByTestId("single-value-single-value-home-main")).toHaveTextContent("12.04");
    expect(screen.getByText("V")).toBeInTheDocument();
    expect(screen.getByTestId("single-value-single-value-home-main")).toHaveStyle({
      color: "#2563eb",
    });
    expect(screen.queryByLabelText("Set value")).not.toBeInTheDocument();
    expect(mockConnection.subscribeScpiQuery).not.toHaveBeenCalled();
    expect(mockConnection.subscribeScpiSnapshot).toHaveBeenCalledWith(
      "PSU1",
      "MEAS:VOLT? CH1",
      expect.any(Function),
    );
  });

  it("updates from SCPI snapshot notifications without a widget-local interval", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    let snapshot = {
      value: "12.04",
      updatedAt: 100,
      loading: false,
      error: "",
    };
    let snapshotListener = null;
    mockConnection.getScpiQuerySnapshot.mockImplementation(() => snapshot);
    mockConnection.subscribeScpiSnapshot.mockImplementation((_deviceName, _query, listener) => {
      snapshotListener = listener;
      return vi.fn();
    });
    saveConfig("single-value-home-main", "MEAS:VOLT? CH1", "Voltage");

    const { rerender } = render(<SingleValueCard placement={{ id: "single-value-home-main" }} />);
    expect(screen.getByTestId("single-value-single-value-home-main")).toHaveTextContent("12.04");

    snapshot = {
      value: "12.15",
      updatedAt: 101,
      loading: false,
      error: "",
    };
    act(() => {
      snapshotListener();
    });

    expect(screen.getByTestId("single-value-single-value-home-main")).toHaveTextContent("12.15");
    expect(setIntervalSpy).not.toHaveBeenCalled();
    mockConnection.deviceStatuses = { 0: { state: "DISCONNECTED" } };
    rerender(<SingleValueCard placement={{ id: "single-value-home-main" }} />);
    expect(screen.getByTestId("single-value-single-value-home-main")).toHaveTextContent("--");
  });

  it("shows opt-in controls and updates the measurement through the shared snapshot", async () => {
    saveConfig("write", "MEAS:VOLT? CH1", "Voltage");
    const stored = JSON.parse(localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY));
    stored.write = {
      ...stored.write,
      setValueEnabled: true,
      setValueCommand: "VOLT {value}",
      defaultValue: "0",
    };
    localStorage.setItem(WIDGET_CONFIG_STORAGE_KEY, JSON.stringify(stored));

    let snapshot = {
      value: "12",
      updatedAt: 1,
      loading: false,
      error: "",
    };
    let notifySnapshotChanged;

    mockConnection.getScpiQuerySnapshot.mockImplementation(() => snapshot);
    mockConnection.subscribeScpiSnapshot.mockImplementation((_device, _query, listener) => {
      notifySnapshotChanged = listener;
      return vi.fn();
    });
    mockConnection.refreshScpiQuery.mockImplementationOnce(() => {
      snapshot = { ...snapshot, loading: true };
      notifySnapshotChanged();
      return true;
    });

    render(<SingleValueCard placement={{ id: "write" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Default" }));

    await waitFor(() => {
      expect(mockConnection.refreshScpiQuery).toHaveBeenCalledWith("PSU1", "MEAS:VOLT? CH1");
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // Preserve the last measured value until the follow-up query actually responds.
    expect(screen.getByTestId("single-value-write")).toHaveTextContent("12");

    act(() => {
      snapshot = { ...snapshot, value: "0.01", loading: false, updatedAt: 2 };
      notifySnapshotChanged();
    });

    expect(screen.getByTestId("single-value-write")).toHaveTextContent("0.01");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Set value")).toHaveValue("");
  });

  it("saves settings under the placement id", () => {
    render(<SingleValueCardActions placement={{ id: "single-value-home-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure single value card" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("SCPI query"), { target: { value: "MEAS:VOLT? CH1" } });
    fireEvent.change(screen.getByLabelText("Frequency (Hz)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "V" } });
    fireEvent.change(screen.getByLabelText("Card name"), { target: { value: "Voltage" } });
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "#2563eb" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))).toMatchObject({
      "single-value-home-main": {
        type: "singleValue",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        frequencyHz: 2,
        unit: "V",
        cardName: "Voltage",
        valueColor: "#2563eb",
      },
    });
  });

  it("validates opt-in settings, preserves disabled fields, and cancels edits", () => {
    saveConfig("write", "MEAS:VOLT? CH1", "Voltage");
    render(<SingleValueCardActions placement={{ id: "write" }} />);

    openSettings();
    expect(screen.queryByLabelText("Set value SCPI command")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Enable value setting"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    // An enabled write needs a command with exactly one substitution point.
    fireEvent.change(screen.getByLabelText("Set value SCPI command"), {
      target: { value: "VOLT {value} {value}" },
    });
    expect(screen.getByText(
      "Set value SCPI command must contain exactly one {value} placeholder.",
    )).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Set value SCPI command"), {
      target: { value: "VOLT {value}" },
    });
    fireEvent.change(screen.getByLabelText("Default value"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const savedConfig = JSON.parse(localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY)).write;
    expect(savedConfig).toMatchObject({
      setValueEnabled: true,
      setValueCommand: "VOLT {value}",
      defaultValue: "0",
    });

    // Cancelling the dialog must restore the persisted default on the next open.
    openSettings();
    fireEvent.change(screen.getByLabelText("Default value"), { target: { value: "99" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    openSettings();
    expect(screen.getByLabelText("Default value")).toHaveValue("0");

    // Disabling removes the controls but keeps their configuration for later reuse.
    fireEvent.click(screen.getByLabelText("Enable value setting"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    openSettings();
    fireEvent.click(screen.getByLabelText("Enable value setting"));
    expect(screen.getByLabelText("Default value")).toHaveValue("0");
  });

  it("keeps separate configs for separate widget ids", () => {
    saveConfig("single-value-home-voltage", "MEAS:VOLT? CH1", "Voltage");
    saveConfig("single-value-home-current", "MEAS:CURR? CH1", "Current");

    render(
      <>
        <SingleValueCard placement={{ id: "single-value-home-voltage" }} />
        <SingleValueCard placement={{ id: "single-value-home-current" }} />
      </>,
    );

    expect(screen.getAllByTestId(/single-value-single-value-home-/)).toHaveLength(2);
    expect(mockConnection.subscribeScpiQuery).not.toHaveBeenCalled();
  });

  it("shows validation feedback for invalid queries", () => {
    render(<SingleValueCardActions placement={{ id: "single-value-home-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure single value card" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("SCPI query"), { target: { value: "OUTP ON" } });

    expect(screen.getByText(/query marker/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

/** Opens the header settings dialog for the single widget rendered by a test. */
function openSettings() {
  fireEvent.click(screen.getByRole("button", { name: "Configure single value card" }));
}

/**
 * Seeds a read-only widget while preserving any other test widget records.
 *
 * @param {string} widgetId - Persisted placement identifier.
 * @param {string} query - Measurement query.
 * @param {string} cardName - Dashboard title.
 */
function saveConfig(widgetId, query, cardName) {
  const current = JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY) || "{}");

  window.localStorage.setItem(
    WIDGET_CONFIG_STORAGE_KEY,
    JSON.stringify({
      ...current,
      [widgetId]: {
        type: "singleValue",
        deviceName: "PSU1",
        query,
        frequencyHz: 1,
        unit: "V",
        cardName,
        valueColor: "#2563eb",
      },
    }),
  );
}
