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
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartCard, ChartCardActions } from "../components/ChartCard.jsx";
import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";

describe("ChartCard", () => {
  it("shows the unconfigured placeholder", () => {
    render(<ChartCard placement={{ id: "chart-home-main" }} />);

    expect(screen.getByText("Configure a target device and SCPI query.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configure" })).not.toBeInTheDocument();
  });

  it("keeps header export disabled until its chart has numeric samples", () => {
    const placement = { id: "chart-home-main" };
    const { rerender } = render(<ChartCardActions placement={placement} />);
    expect(screen.getByRole("button", { name: "Export chart as PNG" })).toBeDisabled();

    saveChartConfig("chart-home-main", [{
      id: "voltage",
      label: "Voltage",
      deviceName: "PSU1",
      query: "MEAS:VOLT? CH1",
      lineColor: "#2563eb",
    }]);
    rerender(
      <>
        <ChartCardActions placement={placement} />
        <ChartCard placement={placement} />
      </>,
    );

    expect(screen.getByRole("button", { name: "Export chart as PNG" })).toBeEnabled();
  });

  it("saves chart settings under the placement id", () => {
    render(<ChartCardActions placement={{ id: "chart-home-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure chart card" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("SCPI query"), { target: { value: "MEAS:VOLT? CH1" } });
    fireEvent.change(screen.getByLabelText("Frequency (Hz)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "V" } });
    fireEvent.change(screen.getByLabelText("History cap (KiB)"), { target: { value: "64" } });
    fireEvent.click(screen.getByRole("button", { name: "Show statistics" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Show Average" }));
    fireEvent.change(screen.getByLabelText("Card name"), { target: { value: "Voltage Trend" } });
    fireEvent.change(screen.getByLabelText("Line label"), { target: { value: "Voltage" } });
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "#dc2626" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY))).toMatchObject({
      "chart-home-main": {
        type: "chart",
        cardName: "Voltage Trend",
        frequencyHz: 2,
        historyLimitBytes: 65536,
        unit: "V",
        statistics: {
          showStatistics: true,
          seriesId: "series-1",
          enabledStats: {
            count: false,
            avg: true,
            median: false,
            min: true,
            max: true,
            ripplePeakToPeak: true,
            rippleRms: false,
            typicalRippleP95P5: false,
            stdDev: false,
            maxDelta: false,
            avgDelta: false,
            trendPerSecond: false,
            drift: false,
            spikeCount: false,
            frequencyHz: false,
            periodSeconds: false,
          },
        },
        series: [
          {
            id: "series-1",
            label: "Voltage",
            deviceName: "PSU1",
            query: "MEAS:VOLT? CH1",
            lineColor: "#dc2626",
          },
        ],
      },
    });
  });

  it("blocks history caps above 256 KiB", () => {
    render(<ChartCardActions placement={{ id: "chart-home-main" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Configure chart card" }));
    fireEvent.change(screen.getByLabelText("Device"), { target: { value: "PSU1" } });
    fireEvent.change(screen.getByLabelText("SCPI query"), { target: { value: "MEAS:VOLT? CH1" } });
    fireEvent.change(screen.getByLabelText("History cap (KiB)"), { target: { value: "300" } });

    expect(screen.getByText("History cap must be between 1 KiB and 256 KiB.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

});
