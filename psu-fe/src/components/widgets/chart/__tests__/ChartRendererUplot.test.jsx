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
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChartRenderer,
  createUplotOptions,
  paddedValueRange,
  toUplotData,
} from "../renderers/ChartRendererUplot.jsx";

const mockUplot = vi.hoisted(() => ({
  instances: [],
  constructor: vi.fn(function UplotMock(options, data, root) {
    this.options = options;
    this.data = data;
    this.root = root;
    this.setData = vi.fn((nextData) => {
      this.data = nextData;
    });
    this.setSize = vi.fn();
    this.setScale = vi.fn((scaleKey, range) => {
      this.scales[scaleKey] = range;
    });
    this.batch = vi.fn((transaction) => {
      transaction();
    });
    this.scales = {
      x: { min: 1, max: 2 },
      y: { min: 10, max: 20 },
    };
    this.destroy = vi.fn();
    mockUplot.instances.push(this);
    for (const ready of options.hooks?.ready || []) {
      ready(this);
    }
  }),
}));

vi.mock("uplot", () => ({
  default: mockUplot.constructor,
}));

const SERIES_DATA = [
  {
    id: "voltage",
    label: "Voltage",
    color: "#2563eb",
    points: [
      { t: 1000, y: 12.04 },
      { t: 2000, y: 12.24 },
    ],
  },
  {
    id: "current",
    label: "Current",
    color: "#0f766e",
    points: [{ t: 2000, y: 1.5 }],
  },
];

describe("ChartRendererUplot", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mockUplot.instances = [];
    mockUplot.constructor.mockClear();
  });

  it("renders empty state without creating a plot", () => {
    render(<ChartRenderer seriesData={[]} statusText="Waiting" targetText="PSU1" unit="V" usageText="0 / 256 KiB" />);

    expect(screen.getByText("Waiting for numeric samples.")).toBeInTheDocument();
    expect(screen.getByText("0 / 256 KiB")).toBeInTheDocument();
    expect(screen.queryByTestId("chart-statistics")).not.toBeInTheDocument();
    expect(mockUplot.constructor).not.toHaveBeenCalled();
  });

  it("aligns timestamps and carries the previous value forward between series samples", () => {
    expect(toUplotData(SERIES_DATA)).toEqual({
      totalPoints: 3,
      data: [
        [1, 2],
        [12.04, 12.24],
        [null, 1.5],
      ],
    });
  });

  it("carries a series value forward across timestamps contributed by another series", () => {
    expect(toUplotData([
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [{ t: 1000, y: 12 }, { t: 3000, y: 13 }],
      },
      {
        id: "current",
        label: "Current",
        color: "#0f766e",
        points: [{ t: 1000, y: 1.2 }, { t: 2000, y: 1.3 }],
      },
    ])).toEqual({
      totalPoints: 4,
      data: [
        [1, 2, 3],
        [12, 12, 13],
        [1.2, 1.3, 1.3],
      ],
    });
  });

  it("creates and destroys a uPlot instance", () => {
    const { unmount } = render(
      <ChartRenderer
        seriesData={SERIES_DATA}
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
    expect(screen.getByText("1.2 / 256 KiB")).toBeInTheDocument();
    expect(screen.getByTestId("chart-statistics")).toBeInTheDocument();
    expect(screen.getByText("Voltage stats")).toBeInTheDocument();
    expect(mockUplot.constructor).toHaveBeenCalledTimes(1);
    expect(mockUplot.instances[0].data).toEqual([
      [1, 2],
      [12.04, 12.24],
      [null, 1.5],
    ]);

    unmount();

    expect(mockUplot.instances[0].destroy).toHaveBeenCalled();
  });

  it("configures cursor, legend, colors, and unit formatting", () => {
    const options = createUplotOptions({
      height: 150,
      seriesData: SERIES_DATA,
      statusText: "MEAS:VOLT?",
      targetText: "PSU1",
      usageText: "1.2 / 256 KiB",
      unit: "V",
      width: 640,
    });

    expect(options.cursor).toMatchObject({ show: true, x: true, y: true });
    expect(options.legend).toMatchObject({ show: true, live: true });
    expect(options.axes[0]).toMatchObject({ show: false, size: 0 });
    expect(options.axes[1]).toMatchObject({ size: 58, gap: 6 });
    expect(options.series[0].label).toBe("T");
    expect(options.series[0].value(null, new Date(2026, 0, 2, 3, 4, 5, 6).getTime() / 1000)).toBe(
      "03:04:05.006",
    );
    expect(options.series[1]).toMatchObject({ label: "Voltage", stroke: "#2563eb" });
    expect(options.series[1].points).toMatchObject({ show: false });
    expect(options.series[1].value(null, 12.04)).toBe("12.0400 V");
  });

  it("updates an existing plot with uPlot default scaling when data changes", () => {
    const { rerender } = render(
      <ChartRenderer
        seriesData={[SERIES_DATA[0]]}
        statusText="MEAS:VOLT?"
        targetText="PSU1"
        unit="V"
        usageText="1.2 / 256 KiB"
      />,
    );
    const plot = mockUplot.instances[0];
    plot.setScale.mockClear();

    rerender(
      <ChartRenderer
        seriesData={[
          {
            ...SERIES_DATA[0],
            points: [...SERIES_DATA[0].points, { t: 3000, y: 12.5 }],
          },
        ]}
        statusText="MEAS:VOLT?"
        targetText="PSU1"
        unit="V"
        usageText="1.3 / 256 KiB"
      />,
    );

    expect(plot.setData).toHaveBeenCalledWith(
      [
        [1, 2, 3],
        [12.04, 12.24, 12.5],
      ],
    );
    expect(plot.setScale).not.toHaveBeenCalled();
  });

  it("preserves user x zoom on data updates", () => {
    const onVisibleTimeRangeChange = vi.fn();
    const { rerender } = render(
      <ChartRenderer
        onVisibleTimeRangeChange={onVisibleTimeRangeChange}
        seriesData={[SERIES_DATA[0]]}
        statusText="MEAS:VOLT?"
        targetText="PSU1"
        unit="V"
        usageText="1.2 / 256 KiB"
      />,
    );
    const plot = mockUplot.instances[0];
    plot.scales.x = { min: 1.2, max: 1.8 };

    plot.options.cursor.bind.mousedown(plot, plot.root, vi.fn())({
      button: 0,
      target: plot.root,
    });
    for (const setScaleHook of plot.options.hooks.setScale) {
      setScaleHook(plot, "x");
    }
    expect(onVisibleTimeRangeChange).toHaveBeenCalledWith({ minMs: 1200, maxMs: 1800 });
    plot.setData.mockClear();
    plot.setScale.mockClear();

    rerender(
      <ChartRenderer
        onVisibleTimeRangeChange={onVisibleTimeRangeChange}
        seriesData={[
          {
            ...SERIES_DATA[0],
            points: [...SERIES_DATA[0].points, { t: 3000, y: 12.5 }],
          },
        ]}
        statusText="MEAS:VOLT?"
        targetText="PSU1"
        unit="V"
        usageText="1.3 / 256 KiB"
      />,
    );

    expect(plot.batch).toHaveBeenCalled();
    expect(plot.setData).toHaveBeenCalledWith(
      [
        [1, 2, 3],
        [12.04, 12.24, 12.5],
      ],
      false,
    );
    expect(plot.setScale).toHaveBeenCalledWith("x", { min: 1.2, max: 1.8 });
  });

  it("captures x zoom when mousedown target differs from the bound uPlot target", () => {
    const { rerender } = render(
      <ChartRenderer
        seriesData={[SERIES_DATA[0]]}
        statusText="MEAS:VOLT?"
        targetText="PSU1"
        unit="V"
        usageText="1.2 / 256 KiB"
      />,
    );
    const plot = mockUplot.instances[0];
    plot.scales.x = { min: 1.2, max: 1.8 };

    plot.options.cursor.bind.mousedown(plot, plot.root, vi.fn())({
      button: 0,
      target: document.createElement("div"),
    });
    for (const setScaleHook of plot.options.hooks.setScale) {
      setScaleHook(plot, "x");
    }
    plot.setData.mockClear();
    plot.setScale.mockClear();

    rerender(
      <ChartRenderer
        seriesData={[
          {
            ...SERIES_DATA[0],
            points: [...SERIES_DATA[0].points, { t: 3000, y: 12.5 }],
          },
        ]}
        statusText="MEAS:VOLT?"
        targetText="PSU1"
        unit="V"
        usageText="1.3 / 256 KiB"
      />,
    );

    expect(plot.setData).toHaveBeenCalledWith(
      [
        [1, 2, 3],
        [12.04, 12.24, 12.5],
      ],
      false,
    );
    expect(plot.setScale).toHaveBeenCalledWith("x", { min: 1.2, max: 1.8 });
  });

  it("returns to default autoscaling after double-click reset", () => {
    const onVisibleTimeRangeChange = vi.fn();
    const { rerender } = render(
      <ChartRenderer
        onVisibleTimeRangeChange={onVisibleTimeRangeChange}
        seriesData={[SERIES_DATA[0]]}
        statusText="MEAS:VOLT?"
        targetText="PSU1"
        unit="V"
      />,
    );
    const plot = mockUplot.instances[0];
    plot.scales.x = { min: 1.2, max: 1.8 };

    plot.options.cursor.bind.mousedown(plot, plot.root, vi.fn())({
      button: 0,
      target: plot.root,
    });
    for (const setScaleHook of plot.options.hooks.setScale) {
      setScaleHook(plot, "x");
    }
    plot.options.cursor.bind.dblclick(plot, plot.root, vi.fn())({});
    expect(onVisibleTimeRangeChange).toHaveBeenLastCalledWith(null);
    plot.setData.mockClear();
    plot.setScale.mockClear();

    rerender(
      <ChartRenderer
        onVisibleTimeRangeChange={onVisibleTimeRangeChange}
        seriesData={[
          {
            ...SERIES_DATA[0],
            points: [...SERIES_DATA[0].points, { t: 3000, y: 12.5 }],
          },
        ]}
        statusText="MEAS:VOLT?"
        targetText="PSU1"
        unit="V"
      />,
    );

    expect(plot.setData).toHaveBeenCalledWith([
      [1, 2, 3],
      [12.04, 12.24, 12.5],
    ]);
    expect(plot.setScale).not.toHaveBeenCalled();
  });

  it("does not recreate the plot for display-only status text changes", () => {
    const { rerender } = render(
      <ChartRenderer
        seriesData={[SERIES_DATA[0]]}
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
        statusText="Loading"
        targetText="PSU1"
        unit="V"
        usageText="1.2 / 256 KiB"
      />,
    );
    const plot = mockUplot.instances[0];

    rerender(
      <ChartRenderer
        seriesData={[SERIES_DATA[0]]}
        statistics={{
          count: 2,
          min: 12.04,
          max: 12.3,
          ripplePeakToPeak: 0.26,
        }}
        statisticsConfig={{
          showStatistics: true,
          enabledStats: { min: true, max: true, ripplePeakToPeak: true },
        }}
        statisticsSeries={{ id: "voltage", label: "Voltage" }}
        statusText="MEAS:VOLT?"
        targetText="PSU1"
        unit="V"
        usageText="1.3 / 256 KiB"
      />,
    );

    expect(mockUplot.constructor).toHaveBeenCalledTimes(1);
    expect(plot.destroy).not.toHaveBeenCalled();
    expect(plot.root).toHaveAttribute("aria-label", "Chart plot MEAS:VOLT?");
    expect(screen.getByText("0.2600 V")).toBeInTheDocument();
  });

  it("pads flat and low-variance y ranges", () => {
    expect(paddedValueRange(0, 0)).toEqual([-1, 1]);
    expect(paddedValueRange(12, 12)).toEqual([10.8, 13.2]);

    const [min, max] = paddedValueRange(0, 0.01);
    expect(min).toBeLessThan(0);
    expect(max).toBeGreaterThan(0.01);
  });
});
