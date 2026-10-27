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
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartCard } from "../components/ChartCard.jsx";

describe("ChartCard.series", () => {
  it("ignores non-numeric samples", () => {
    mockConnection.getScpiQuerySnapshot.mockReturnValue({
      value: "not-a-number",
      updatedAt: 1000,
      loading: false,
      error: "",
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

    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
    expect(screen.queryByTestId("chart-plot")).not.toBeInTheDocument();
  });

  it("renders multiple configured series through the array data path", () => {
    mockConnection.getScpiQuerySnapshot.mockImplementation((deviceName, query) => ({
      value: query.includes("CURR") ? "1.5" : "12.04",
      updatedAt: query.includes("CURR") ? 2000 : 1000,
      loading: false,
      error: "",
      deviceName,
    }));
    saveChartConfig("chart-home-main", [
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
    ]);

    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByTestId("chart-plot")).toBeInTheDocument();
    expect(mockUplot.instances[0].data).toHaveLength(3);
    expect(mockConnection.subscribeScpiSnapshot).toHaveBeenCalledTimes(2);
  });

});
