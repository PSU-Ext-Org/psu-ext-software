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
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SingleValueCard, SingleValueCardActions } from "../components/SingleValueCard.jsx";
import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";

const mockConnection = vi.hoisted(() => ({
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

    render(<SingleValueCard placement={{ id: "single-value-home-main" }} />);
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
