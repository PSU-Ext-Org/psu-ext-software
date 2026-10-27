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
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChartCard, ChartCardActions } from "../components/ChartCard.jsx";

import { CHART_HISTORY_STORAGE_KEY, saveChartHistory } from "../storage/chartHistoryStorage.js";

describe("ChartCard.historyReset", () => {
  it("renders again when a new sample arrives after clearing history", async () => {
    const series = [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ];
    let snapshot = {
      value: "",
      updatedAt: 0,
      loading: false,
      error: "",
    };
    let snapshotListener = null;
    mockConnection.getScpiQuerySnapshot.mockImplementation(() => snapshot);
    mockConnection.subscribeScpiSnapshot.mockImplementation((_deviceName, _query, listener) => {
      snapshotListener = listener;
      return vi.fn();
    });
    saveChartConfig("chart-home-main", series);
    saveChartHistory("chart-home-main", { series }, [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [
          { t: 1000, y: 12.04 },
          { t: 2000, y: 12.24 },
        ],
      },
    ]);

    render(
      <>
        <ChartCardActions placement={{ id: "chart-home-main" }} />
        <ChartCard placement={{ id: "chart-home-main" }} />
      </>,
    );
    expect(screen.getByTestId("chart-plot")).toBeInTheDocument();
    const initialInstance = mockUplot.instances[0];

    fireEvent.click(screen.getByRole("button", { name: "Clear chart history" }));
    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
    expect(mockConnection.subscribeScpiSnapshot).toHaveBeenCalledTimes(2);

    snapshot = {
      value: "12.5",
      updatedAt: 3000,
      loading: false,
      error: "",
    };
    act(() => {
      snapshotListener();
    });

    await waitFor(() => expect(screen.getByTestId("chart-plot")).toBeInTheDocument());
    expect(initialInstance.destroy).toHaveBeenCalled();
    expect(mockUplot.instances.at(-1)).not.toBe(initialInstance);
    expect(mockUplot.instances.at(-1).data).toEqual([[3], [12.5]]);
  });

  it("resets history when a series keeps its id but changes query", () => {
    const originalSeries = [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ];
    const changedSeries = [{ ...originalSeries[0], query: "MEAS:CURR? CH1" }];
    saveChartConfig("chart-home-main", changedSeries);
    saveChartHistory("chart-home-main", { series: originalSeries }, [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [
          { t: 1000, y: 12.04 },
          { t: 2000, y: 12.24 },
        ],
      },
    ]);
    mockConnection.getScpiQuerySnapshot.mockReturnValue({
      value: "",
      updatedAt: 0,
      loading: false,
      error: "",
    });

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
  });

  it("discards older points when the configured history cap is reached", async () => {
    let snapshot = {
      value: "1.0",
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
    ], 1024);

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    for (let index = 2; index <= 80; index += 1) {
      snapshot = {
        value: String(index),
        updatedAt: index * 1000,
        loading: false,
        error: "",
      };
      act(() => {
        snapshotListener();
      });
    }

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY));
      const points = stored["chart-home-main"].series[0].points;
      expect(JSON.stringify(stored["chart-home-main"]).length).toBeLessThanOrEqual(1024);
      expect(points.at(-1)).toMatchObject({ t: 80000, y: 80 });
      expect(points[0].t).toBeGreaterThan(1000);
    });
  });
});
