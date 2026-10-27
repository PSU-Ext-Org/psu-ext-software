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
import { saveChartConfig } from "./chartCardFixture.jsx";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartCard, ChartCardActions } from "../components/ChartCard.jsx";

describe("ChartCard.statistics", () => {
  it("shows statistics only when enabled and renders the default visible stats", () => {
    saveChartConfig("chart-home-main", [
      {
        id: "voltage",
        label: "Voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        lineColor: "#2563eb",
      },
    ], 256 * 1024, {
      showStatistics: true,
    });

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByTestId("chart-statistics")).toBeInTheDocument();
    expect(screen.getByText("Voltage stats")).toBeInTheDocument();
    expect(screen.getByText("Min")).toBeInTheDocument();
    expect(screen.getAllByText("12.0400 V")).toHaveLength(2);
    expect(screen.getByText("Max")).toBeInTheDocument();
    expect(screen.getByText("Ripple p-p")).toBeInTheDocument();
    expect(screen.getByText("0.0000 V")).toBeInTheDocument();
    expect(screen.queryByText("Average")).not.toBeInTheDocument();
    expect(screen.queryByText("Delta")).not.toBeInTheDocument();
  });

  it("shows a statistics series selector when multiple series exist and statistics are enabled", () => {
    saveChartConfig(
      "chart-home-main",
      [
        {
          id: "voltage",
          label: "Voltage",
          deviceName: "PSU1",
          query: "MEAS:VOLT? CH1",
          lineColor: "#2563eb",
        },
        {
          id: "current",
          label: "Current",
          deviceName: "PSU1",
          query: "MEAS:CURR? CH1",
          lineColor: "#0f766e",
        },
      ],
      256 * 1024,
      { showStatistics: true, seriesId: "current" },
    );

    render(<ChartCardActions placement={{ id: "chart-home-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure chart card" }));

    expect(screen.getByLabelText("Statistics series")).toBeInTheDocument();
    expect(screen.getByLabelText("Statistics series")).toHaveValue("current");
  });

  it("shows statistic calculation details from the info button", () => {
    render(<ChartCardActions placement={{ id: "chart-home-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure chart card" }));
    fireEvent.click(screen.getByRole("button", { name: "Show statistics" }));
    fireEvent.click(screen.getByRole("button", { name: "Average calculation details" }));

    const infoDialog = screen.getByRole("dialog", { name: "Average calculation details" });
    expect(infoDialog).toBeInTheDocument();
    expect(within(infoDialog).getByText("Average")).toBeInTheDocument();
    expect(within(infoDialog).getByText("The arithmetic mean of the stored sample values in the selected series.")).toBeInTheDocument();
    expect(within(infoDialog).getByText("Formula")).toBeInTheDocument();
    expect(within(infoDialog).getByText("avg = (sum of all sample values) / N")).toBeInTheDocument();
    expect(within(infoDialog).getByText("How it is calculated")).toBeInTheDocument();
    expect(within(infoDialog).getByText("Sum all sample values in the selected series.")).toBeInTheDocument();
    expect(within(infoDialog).getByText("Divide that sum by the sample count N.")).toBeInTheDocument();

    fireEvent.click(within(infoDialog).getByRole("button", { name: "Close" }));

    expect(screen.queryByText("The arithmetic mean of the stored sample values in the selected series.")).not.toBeInTheDocument();
  });

});
