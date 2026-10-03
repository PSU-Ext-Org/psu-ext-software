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
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartImageExportButton } from "../../chart/index.js";
import { XyChartRenderer } from "../renderers/XyChartRendererUplot.jsx";
import {
  acquisitionOrderMarkers,
  acquisitionOrderPaths,
  createXyLegendRows,
  createXyUplotOptions,
  nearestXyPointIdx,
} from "../utils/xyUplotOptions.js";
import { formatAxisLabel, paddedValueRange, toXyUplotData } from "../utils/xyPlotData.js";

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
    this.setScale = vi.fn();
    this.batch = vi.fn((transaction) => transaction());
    this.scales = { x: { min: 1, max: 2 }, y: { min: 10, max: 20 } };
    this.destroy = vi.fn();
    mockUplot.instances.push(this);
    for (const ready of options.hooks?.ready || []) {
      ready(this);
    }
  }),
}));

vi.mock("uplot", () => ({ default: mockUplot.constructor }));

const X_AXIS = { label: "Voltage", unit: "V" };
const Y_AXIS = { label: "Current", unit: "A" };
const POINTS = [
  { x: 3, y: 0.3, t: 1 },
  { x: 1, y: 0.1, t: 2 },
  { x: 2, y: 0.2, t: 3 },
];

function renderChart(props = {}) {
  return render(
    <XyChartRenderer
      lineColor="#2563eb"
      points={POINTS}
      showLine
      statusText="Waiting"
      targetText="PSU1"
      usageText="3 / 2000 pts"
      xAxis={X_AXIS}
      yAxis={Y_AXIS}
      {...props}
    />,
  );
}

describe("XyChartRendererUplot", () => {
  afterEach(() => {
    cleanup();
    mockUplot.instances = [];
    mockUplot.constructor.mockClear();
    delete mockUplot.constructor.orient;
    vi.unstubAllGlobals();
  });

  it("renders an empty state without creating a plot", () => {
    renderChart({ points: [] });

    expect(screen.getByText("Waiting for paired samples.")).toBeInTheDocument();
    expect(screen.getByText("3 / 2000 pts")).toBeInTheDocument();
    expect(mockUplot.constructor).not.toHaveBeenCalled();
  });

  it("keeps points in acquisition order instead of sorting by X", () => {
    expect(toXyUplotData(POINTS)).toEqual({
      totalPoints: 3,
      data: [null, [[3, 1, 2], [0.3, 0.1, 0.2]]],
    });
  });

  it("adds an X·Y series against X on a right-hand axis", () => {
    expect(toXyUplotData(POINTS, true).data[2]).toEqual([[3, 1, 2], [3 * 0.3, 1 * 0.1, 2 * 0.2]]);

    renderChart({ showProduct: true, productAxis: { label: "Power", unit: "W" }, productColor: "#16a34a" });

    const plot = mockUplot.instances[0];
    expect(plot.options.axes.map((axis) => axis.label)).toEqual(["Voltage (V)", "Current (A)", "Power (W)"]);
    expect(plot.options.axes[2]).toMatchObject({ scale: "xy", side: 1 });
    expect(plot.options.series[2].facets.map((facet) => facet.scale)).toEqual(["x", "xy"]);
    expect(plot.options.series[2].stroke).toBe("#16a34a");
    expect(plot.data).toHaveLength(3);
  });

  it("creates a faceted plot with labelled axes and pushes updates through setData", () => {
    const { rerender } = renderChart();

    expect(mockUplot.constructor).toHaveBeenCalledTimes(1);
    const plot = mockUplot.instances[0];
    expect(plot.options.mode).toBe(2);
    expect(plot.options.axes.map((axis) => axis.label)).toEqual(["Voltage (V)", "Current (A)"]);
    expect(plot.options.series[1].facets.map((facet) => facet.scale)).toEqual(["x", "y"]);
    expect(plot.options.scales.x.time).toBe(false);
    expect(plot.data).toEqual(toXyUplotData(POINTS).data);

    rerender(
      <XyChartRenderer
        lineColor="#2563eb"
        points={[...POINTS, { x: 4, y: 0.4, t: 4 }]}
        showLine
        statusText="Waiting"
        targetText="PSU1"
        usageText="4 / 2000 pts"
        xAxis={X_AXIS}
        yAxis={Y_AXIS}
      />,
    );

    expect(mockUplot.constructor).toHaveBeenCalledTimes(1);
    expect(plot.setData).toHaveBeenLastCalledWith([null, [[3, 1, 2, 4], [0.3, 0.1, 0.2, 0.4]]]);
  });

  it("rebuilds the plot when axis labels or line mode change and destroys it on unmount", () => {
    const { rerender, unmount } = renderChart();
    const first = mockUplot.instances[0];

    rerender(
      <XyChartRenderer
        lineColor="#2563eb"
        points={POINTS}
        showLine={false}
        statusText="Waiting"
        targetText="PSU1"
        usageText="3 / 2000 pts"
        xAxis={X_AXIS}
        yAxis={Y_AXIS}
      />,
    );

    expect(first.destroy).toHaveBeenCalled();
    expect(mockUplot.constructor).toHaveBeenCalledTimes(2);

    unmount();
    expect(mockUplot.instances[1].destroy).toHaveBeenCalled();
  });

  it("restores a user zoom after data updates", () => {
    const { rerender } = renderChart();
    const plot = mockUplot.instances[0];
    const [scaleChange] = plot.options.hooks.setScale;

    plot.options.cursor.bind.mousedown(plot, null, () => {})({ button: 0 });
    scaleChange(plot, "x");
    scaleChange(plot, "y");

    rerender(
      <XyChartRenderer
        lineColor="#2563eb"
        points={[...POINTS, { x: 4, y: 0.4, t: 4 }]}
        showLine
        statusText="Waiting"
        targetText="PSU1"
        usageText="4 / 2000 pts"
        xAxis={X_AXIS}
        yAxis={Y_AXIS}
      />,
    );

    expect(plot.setScale).toHaveBeenCalledWith("x", { min: 1, max: 2 });
    expect(plot.setScale).toHaveBeenCalledWith("y", { min: 10, max: 20 });
  });

  it("forgets the zoom on double click", () => {
    const { rerender } = renderChart();
    const plot = mockUplot.instances[0];
    const [scaleChange] = plot.options.hooks.setScale;
    plot.options.cursor.bind.mousedown(plot, null, () => {})({ button: 0 });
    scaleChange(plot, "x");
    plot.options.cursor.bind.dblclick(plot, null, () => {})({});

    rerender(
      <XyChartRenderer
        lineColor="#2563eb"
        points={[...POINTS, { x: 4, y: 0.4, t: 4 }]}
        showLine
        statusText="Waiting"
        targetText="PSU1"
        usageText="4 / 2000 pts"
        xAxis={X_AXIS}
        yAxis={Y_AXIS}
      />,
    );

    expect(plot.setScale).not.toHaveBeenCalled();
  });

  it("draws a polyline in acquisition order and breaks it at null samples", () => {
    vi.stubGlobal("Path2D", function Path2DMock() {});
    const moveTo = vi.fn();
    const lineTo = vi.fn();
    mockUplot.constructor.orient = vi.fn((_plot, _seriesIdx, callback) =>
      callback(
        {},
        [3, 1, null, 2, 5],
        [0.3, 0.1, 0.5, 0.2, 0.9],
        { id: "x" },
        { id: "y" },
        (value) => value * 10,
        (value) => value * 100,
        0,
        0,
        100,
        100,
        moveTo,
        lineTo,
      ),
    );

    const paths = acquisitionOrderPaths({}, 1);

    expect(moveTo.mock.calls.map(([, x, y]) => [x, y])).toEqual([[30, 30], [20, 20]]);
    expect(lineTo.mock.calls.map(([, x, y]) => [x, y])).toEqual([[10, 10], [50, 90]]);
    expect(paths).toMatchObject({ fill: null, clip: null, flags: 0 });
  });

  it("draws a marker for every non-null sample regardless of uPlot's global index range", () => {
    vi.stubGlobal("Path2D", function Path2DMock() {});
    const moveTo = vi.fn();
    const arc = vi.fn();
    mockUplot.constructor.orient = vi.fn((_plot, _seriesIdx, callback) =>
      callback(
        { points: { size: 6 } },
        [3, 1, null, 2],
        [0.3, 0.1, 0.5, 0.2],
        { id: "x" },
        { id: "y" },
        (value) => value * 10,
        (value) => value * 100,
        0,
        0,
        100,
        100,
        moveTo,
        vi.fn(),
        vi.fn(),
        arc,
      ),
    );

    const paths = acquisitionOrderMarkers({}, 1, 5, 4);

    expect(arc.mock.calls.map(([, x, y]) => [x, y])).toEqual([[30, 30], [10, 10], [20, 20]]);
    expect(moveTo).toHaveBeenCalledTimes(3);
    expect(paths).toMatchObject({ stroke: null, clip: null, flags: 0 });
  });

  it("draws markers only when the line is disabled", () => {
    const options = createXyUplotOptions({
      lineColor: "#2563eb",
      showLine: false,
      statusText: "",
      xAxis: X_AXIS,
      yAxis: Y_AXIS,
    });

    expect(options.series[1].paths()).toBeNull();
    expect(options.series[1].points.show).toBe(true);
    expect(options.series[1].points.paths).toBe(acquisitionOrderMarkers);
  });

  it("enables PNG export only once points are plotted", () => {
    const { rerender } = render(
      <>
        <ChartImageExportButton exportId="xy-a" />
        <XyChartRenderer
          chartExport={{ id: "xy-a", fileStem: "I-V Curve" }}
          lineColor="#2563eb"
          points={[]}
          showLine
          statusText="Waiting"
          targetText="PSU1"
          usageText="0 / 2000 pts"
          xAxis={X_AXIS}
          yAxis={Y_AXIS}
        />
      </>,
    );

    expect(screen.getByRole("button", { name: "Export chart as PNG" })).toBeDisabled();

    rerender(
      <>
        <ChartImageExportButton exportId="xy-a" />
        <XyChartRenderer
          chartExport={{ id: "xy-a", fileStem: "I-V Curve" }}
          lineColor="#2563eb"
          points={POINTS}
          showLine
          statusText="Waiting"
          targetText="PSU1"
          usageText="3 / 2000 pts"
          xAxis={X_AXIS}
          yAxis={Y_AXIS}
        />
      </>,
    );

    expect(screen.getByRole("button", { name: "Export chart as PNG" })).toBeEnabled();
  });

  it("lets a click lock the cursor and reports the point under it", () => {
    const onCursorPoint = vi.fn();
    const options = createXyUplotOptions({
      lineColor: "#2563eb",
      onCursorPoint,
      showLine: true,
      statusText: "",
      xAxis: X_AXIS,
      yAxis: Y_AXIS,
    });

    expect(options.legend).toEqual({ show: false });
    expect(options.cursor).toMatchObject({ lock: true, dataIdx: nearestXyPointIdx });
    options.hooks.setCursor[0]({ cursor: { idxs: [null, 2] } });
    options.hooks.setCursor[0]({ cursor: { idxs: [null, null] } });
    expect(onCursorPoint.mock.calls).toEqual([[2], [null]]);
  });

  it("shows an X row and one row per line with its own value", () => {
    renderChart({ showProduct: true, productAxis: { label: "Power", unit: "W" }, productColor: "#16a34a" });

    const legend = screen.getByTestId("xy-chart-legend");
    const rows = [...legend.querySelectorAll("tr")].map((row) => row.textContent);
    expect(rows).toEqual(["Voltage2 V", "Current0.2 A", "Power0.4 W"]);
    const markers = [...legend.querySelectorAll(".u-marker")].map((marker) => marker.style.border);
    // jsdom reports inline colors in rgb() form: #2563eb, #2563eb, #16a34a.
    expect(markers).toEqual(["2px solid rgb(37, 99, 235)", "2px solid rgb(37, 99, 235)", "2px solid rgb(22, 163, 74)"]);

    act(() => mockUplot.instances[0].options.hooks.setCursor[0]({ cursor: { idxs: [null, 0] } }));
    expect([...legend.querySelectorAll("tr")].map((row) => row.textContent)).toEqual([
      "Voltage3 V",
      "Current0.3 A",
      "Power0.9 W",
    ]);
  });

  it("picks the point nearest to the cursor on screen for every line", () => {
    const plot = {
      cursor: { left: 21, top: 79 },
      data: toXyUplotData(POINTS, true).data,
      series: [{}, { facets: [{ scale: "x" }, { scale: "y" }] }, { facets: [{ scale: "x" }, { scale: "xy" }] }],
      valToPos: (value, scale) => (scale === "x" ? value * 10 : 100 - value * 100),
    };

    // Y points sit at (30, 70), (10, 90) and (20, 80) on screen; the cursor is next to the third one.
    expect(nearestXyPointIdx(plot, 1)).toBe(2);
    expect(nearestXyPointIdx(plot, 2)).toBe(2);
    expect(nearestXyPointIdx(plot, 0)).toBeNull();
    expect(nearestXyPointIdx({ ...plot, cursor: { left: -10, top: -10 } }, 1)).toBeNull();
  });

  it("uses the locked cursor point in export legend rows", () => {
    const rows = createXyLegendRows({ points: POINTS, cursorIdx: 1, xAxis: X_AXIS, yAxis: Y_AXIS, lineColor: "#2563eb" });

    expect(rows).toEqual([
      { color: "#2563eb", label: "Voltage", value: "1 V" },
      { color: "#2563eb", label: "Current", value: "0.1 A" },
    ]);
  });

  it("builds export legend rows from the latest point", () => {
    const rows = createXyLegendRows({
      points: POINTS,
      xAxis: X_AXIS,
      yAxis: Y_AXIS,
      lineColor: "#2563eb",
      showProduct: true,
      productAxis: { label: "Power", unit: "W" },
      productColor: "#16a34a",
    });

    expect(rows).toEqual([
      { color: "#2563eb", label: "Voltage", value: "2 V" },
      { color: "#2563eb", label: "Current", value: "0.2 A" },
      { color: "#16a34a", label: "Power", value: "0.4 W" },
    ]);
    expect(createXyLegendRows({ points: [], xAxis: X_AXIS, yAxis: Y_AXIS, lineColor: "#000000" })).toEqual([
      { color: "#000000", label: "Voltage", value: "--" },
      { color: "#000000", label: "Current", value: "--" },
    ]);
    expect(
      createXyLegendRows({ points: POINTS, xAxis: { label: "X", unit: "" }, yAxis: Y_AXIS, lineColor: "#000000" })[0],
    ).toEqual({ color: "#000000", label: "X", value: "2" });
  });

  it("formats axis labels and pads ranges", () => {
    expect(formatAxisLabel({ label: "Voltage", unit: "V" })).toBe("Voltage (V)");
    expect(formatAxisLabel({ label: "Voltage", unit: "" })).toBe("Voltage");
    expect(paddedValueRange(1, 1)).toEqual([0, 2]);
    expect(paddedValueRange(Number.NaN, 1)).toEqual([0, 1]);
    const [min, max] = paddedValueRange(0, 10);
    expect(min).toBeLessThan(0);
    expect(max).toBeGreaterThan(10);
  });
});
