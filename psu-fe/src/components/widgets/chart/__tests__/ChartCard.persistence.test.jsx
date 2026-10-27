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
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartCard, ChartCardActions } from "../components/ChartCard.jsx";

import { CHART_HISTORY_STORAGE_KEY, saveChartHistory } from "../storage/chartHistoryStorage.js";

describe("ChartCard.persistence", () => {
  it("restores persisted history on mount", () => {
    const series = [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ];
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
    mockConnection.getScpiQuerySnapshot.mockReturnValue({
      value: "",
      updatedAt: 0,
      loading: false,
      error: "",
    });

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByTestId("chart-plot")).toBeInTheDocument();
    expect(screen.getByText(/\/ 256 KiB/)).toBeInTheDocument();
    expect(mockUplot.instances[0].data[0]).toEqual([1, 2]);
  });

  it("keeps chart histories isolated by widget id", () => {
    const series = [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ];
    saveChartConfig("chart-home-main", series);
    saveChartConfig("chart-home-other", series);
    saveChartHistory("chart-home-other", { series }, [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [
          { t: 1000, y: 11 },
          { t: 2000, y: 12 },
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

  it("clears visible and persisted history from the chart action", () => {
    const series = [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ];
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
    mockConnection.getScpiQuerySnapshot.mockReturnValue({
      value: "",
      updatedAt: 0,
      loading: false,
      error: "",
    });

    render(
      <>
        <ChartCardActions placement={{ id: "chart-home-main" }} />
        <ChartCard placement={{ id: "chart-home-main" }} />
      </>,
    );
    expect(screen.getByTestId("chart-plot")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear chart history" }));

    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY))).not.toHaveProperty(
      "chart-home-main",
    );
  });

});
