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
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartRenderer } from "../renderers/ChartRendererSvg.jsx";

describe("ChartRendererSvg", () => {
  it("renders empty state", () => {
    render(<ChartRenderer seriesData={[]} statusText="Waiting" targetText="PSU1" unit="V" usageText="0 / 256 KiB" />);

    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
    expect(screen.getByText("0 / 256 KiB")).toBeInTheDocument();
  });

  it("renders SVG line paths for numeric samples", () => {
    const firstTimestamp = new Date(2026, 0, 2, 3, 4, 5, 6).getTime();
    const secondTimestamp = new Date(2026, 0, 2, 3, 4, 5, 106).getTime();

    render(
      <ChartRenderer
        seriesData={[
          {
            id: "voltage",
            label: "Voltage",
            color: "#2563eb",
            points: [
              { t: firstTimestamp, y: 12.04 },
              { t: secondTimestamp, y: 12.24 },
            ],
          },
        ]}
        statistics={{
          count: 2,
          min: 12.04,
          max: 12.24,
          ripplePeakToPeak: 0.2,
        }}
        statisticsConfig={{
          showStatistics: true,
          enabledStats: { min: true, max: true, ripplePeakToPeak: true },
        }}
        statisticsSeries={{ id: "voltage", label: "Voltage" }}
        statusText="MEAS:VOLT?"
        targetText="PSU1"
        unit="V"
        usageText="1.2 / 256 KiB"
      />,
    );

    expect(screen.getByTestId("chart-plot")).toBeInTheDocument();
    expect(screen.getByTestId("chart-line-voltage")).toHaveAttribute("stroke", "#2563eb");
    expect(screen.getByTestId("chart-line-voltage").getAttribute("d")).toContain("L ");
    expect(screen.getByText("03:04:05.006")).toBeInTheDocument();
    expect(screen.getByText("03:04:05.106")).toBeInTheDocument();
    expect(screen.getByText("1.2 / 256 KiB")).toBeInTheDocument();
    expect(screen.getByTestId("chart-statistics")).toBeInTheDocument();
    expect(screen.getByText("Voltage stats")).toBeInTheDocument();
  });
});
