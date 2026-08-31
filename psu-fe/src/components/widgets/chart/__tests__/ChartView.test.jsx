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
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChartView } from "../components/ChartView.jsx";

vi.mock("../renderers/ChartRenderer.jsx", () => ({
  ChartRenderer: ({ chartExport, onVisibleTimeRangeChange, statistics }) => (
    <div>
      <output aria-label="Export contract">{`${chartExport.id}:${chartExport.fileStem}`}</output>
      <output aria-label="Visible statistics">{JSON.stringify(statistics.values)}</output>
      <button onClick={() => onVisibleTimeRangeChange({ minMs: 1500, maxMs: 2500 })} type="button">Zoom</button>
      <button onClick={() => onVisibleTimeRangeChange(null)} type="button">Reset</button>
    </div>
  ),
}));

describe("ChartView", () => {
  it("passes stable export identity and recalculates statistics for the visible range", () => {
    render(
      <ChartView
        chartExport={{ id: "chart-home-main", fileStem: "Voltage Trend" }}
        config={{
          series: [{ id: "voltage", label: "Voltage" }],
          statistics: { showStatistics: true, seriesId: "voltage", enabledStats: { min: true, max: true } },
          unit: "V",
        }}
        rendererKey="chart"
        seriesData={[{ id: "voltage", label: "Voltage", color: "#2563eb", points: [{ t: 1000, y: 1 }, { t: 2000, y: 2 }, { t: 3000, y: 3 }] }]}
        statusText="Ready"
        targetText="PSU1"
        usageText="3 points"
      />,
    );

    expect(screen.getByLabelText("Export contract")).toHaveTextContent("chart-home-main:Voltage Trend");
    expect(screen.getByLabelText("Visible statistics")).toHaveTextContent('"min":1');
    expect(screen.getByLabelText("Visible statistics")).toHaveTextContent('"max":3');

    fireEvent.click(screen.getByRole("button", { name: "Zoom" }));
    expect(screen.getByLabelText("Visible statistics")).toHaveTextContent('"min":2');
    expect(screen.getByLabelText("Visible statistics")).toHaveTextContent('"max":2');

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Visible statistics")).toHaveTextContent('"min":1');
    expect(screen.getByLabelText("Visible statistics")).toHaveTextContent('"max":3');
  });
});
