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
import { mockUplot, mockConnection, saveChartConfig } from "./chartCardFixture.jsx";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChartCard } from "../components/ChartCard.jsx";

import { CHART_HISTORY_STORAGE_KEY } from "../storage/chartHistoryStorage.js";

describe("ChartCard.samples", () => {
  it("renders numeric samples through the configured renderer", () => {
    saveChartConfig("chart-home-main", [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ]);

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByTestId("chart-plot")).toBeInTheDocument();
    expect(screen.getByText(/PSU1 MEAS:VOLT\? CH1/)).toBeInTheDocument();
    expect(mockUplot.constructor).toHaveBeenCalled();
    expect(mockConnection.subscribeScpiSnapshot).toHaveBeenCalledWith(
      "PSU1",
      "MEAS:VOLT? CH1",
      expect.any(Function),
    );
  });

  it("appends samples from snapshot notifications", async () => {
    let snapshot = {
      value: "12.04",
      updatedAt: 1000,
      loading: false,
      error: "",
    };
    let snapshotListener = null;
    mockConnection.getScpiQuerySnapshot.mockImplementation(() => snapshot);
    mockConnection.subscribeScpiSnapshot.mockImplementation((_deviceName, _query, listener) => {
      snapshotListener = listener;
      return vi.fn();
    });
    saveChartConfig("chart-home-main", [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ]);

    render(<ChartCard placement={{ id: "chart-home-main" }} />);
    const initialInstance = mockUplot.instances[0];

    snapshot = {
      value: "12.24",
      updatedAt: 2000,
      loading: false,
      error: "",
    };
    act(() => {
      snapshotListener();
    });

    await waitFor(() =>
      expect(initialInstance.setData).toHaveBeenCalledWith([
        [1, 2],
        [12.04, 12.24],
      ]),
    );
    expect(mockUplot.instances.at(-1)).toBe(initialInstance);
    expect(JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY))).toHaveProperty(
      "chart-home-main",
    );
    snapshot = { value: "", updatedAt: 0, loading: false, error: "", disconnected: true };
    act(() => snapshotListener());
    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
    expect(initialInstance.destroy).toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY))["chart-home-main"]).toBeUndefined();
    snapshot = { value: "5", updatedAt: 3000, loading: false, error: "" };
    act(() => snapshotListener());
    await waitFor(() => expect(mockUplot.instances.at(-1).data).toEqual([[3], [5]]));
  });

  it("merges overlapping binary DATA intervals without duplicate readings", async () => {
    let snapshot = {
      value: "12.24",
      points: [
        { t: 4900, y: 12.04, sourceT: 1000 },
        { t: 5000, y: 12.24, sourceT: 1100 },
      ],
      updatedAt: 5000,
      loading: false,
      error: "",
    };
    let snapshotListener = null;
    mockConnection.getScpiQuerySnapshot.mockImplementation(() => snapshot);
    mockConnection.subscribeScpiSnapshot.mockImplementation((_deviceName, _query, listener) => {
      snapshotListener = listener;
      return vi.fn();
    });
    saveChartConfig("chart-home-main", [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT:DATA? CH1",
        lineColor: "#2563eb",
      },
    ]);

    render(<ChartCard placement={{ id: "chart-home-main" }} />);
    const initialInstance = mockUplot.instances[0];

    snapshot = {
      value: "12.44",
      points: [
        { t: 5000, y: 12.24, sourceT: 1100 },
        { t: 5100, y: 12.44, sourceT: 1200 },
      ],
      updatedAt: 5100,
      loading: false,
      error: "",
    };
    act(() => {
      snapshotListener();
    });

    await waitFor(() =>
      expect(initialInstance.setData).toHaveBeenCalledWith([
        [4.9, 5, 5.1],
        [12.04, 12.24, 12.44],
      ]),
    );
    expect(JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY))).toMatchObject({
      "chart-home-main": {
        series: [
          {
            points: [
              { t: 4900, y: 12.04, sourceT: 1000 },
              { t: 5000, y: 12.24, sourceT: 1100 },
              { t: 5100, y: 12.44, sourceT: 1200 },
            ],
          },
        ],
      },
    });
  });

});
