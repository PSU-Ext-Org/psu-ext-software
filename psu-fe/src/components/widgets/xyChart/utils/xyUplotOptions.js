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
import uPlot from "uplot";
import { formatAxisLabel, formatAxisNumber, paddedValueRange } from "./xyPlotData.js";

export const DEFAULT_CHART_WIDTH = 640;
export const DEFAULT_CHART_HEIGHT = 240;
export const DEFAULT_PRODUCT_AXIS = Object.freeze({ label: "X·Y", unit: "" });
export const DEFAULT_PRODUCT_COLOR = "#dc2626";
const X_AXIS_SIZE = 52;
const Y_AXIS_SIZE = 72;
const PLOT_PADDING_RIGHT = 10;
/** Width in CSS px taken at the right edge of the chart by the X·Y axis and the plot padding. */
export const PRODUCT_AXIS_RESERVED_WIDTH = Y_AXIS_SIZE + PLOT_PADDING_RIGHT;

/**
 * Builds a path that connects points in acquisition order. uPlot's default linear builder assumes ascending
 * X and would collapse or reorder an X-Y sweep.
 *
 * @param {uPlot} plot
 * @param {number} seriesIdx
 * @returns {object}
 */
export function acquisitionOrderPaths(plot, seriesIdx) {
  return uPlot.orient(
    plot,
    seriesIdx,
    (_series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, lineTo) => {
      const stroke = new Path2D();
      let started = false;

      for (let index = 0; index < dataX.length; index += 1) {
        const xValue = dataX[index];
        const yValue = dataY[index];
        if (xValue == null || yValue == null) {
          started = false;
          continue;
        }

        const xPos = valToPosX(xValue, scaleX, xDim, xOff);
        const yPos = valToPosY(yValue, scaleY, yDim, yOff);
        if (started) {
          lineTo(stroke, xPos, yPos);
        } else {
          moveTo(stroke, xPos, yPos);
          started = true;
        }
      }

      return { stroke, fill: null, clip: null, band: null, gaps: null, flags: 0 };
    },
  );
}

/**
 * Builds the point markers. uPlot's default marker builder walks the global X-scale index range, which is not
 * meaningful for faceted data, so it draws nothing in `mode: 2`.
 *
 * @param {uPlot} plot
 * @param {number} seriesIdx
 * @returns {object}
 */
export function acquisitionOrderMarkers(plot, seriesIdx) {
  return uPlot.orient(
    plot,
    seriesIdx,
    (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim, moveTo, _lineTo, _rect, arc) => {
      const radius = ((series.points?.size || 6) / 2) * (uPlot.pxRatio || 1);
      const fill = new Path2D();

      for (let index = 0; index < dataX.length; index += 1) {
        if (dataX[index] == null || dataY[index] == null) {
          continue;
        }

        const xPos = valToPosX(dataX[index], scaleX, xDim, xOff);
        const yPos = valToPosY(dataY[index], scaleY, yDim, yOff);
        moveTo(fill, xPos + radius, yPos);
        arc(fill, xPos, yPos, radius, 0, Math.PI * 2);
      }

      return { stroke: null, fill, clip: null, flags: 0 };
    },
  );
}

/**
 * @param {object} params
 * @returns {import("uplot").Options}
 */
export function createXyUplotOptions({
  height,
  lineColor,
  onResetZoom,
  onScaleChange,
  onCursorPoint,
  onStartZoom,
  productAxis = DEFAULT_PRODUCT_AXIS,
  productColor = DEFAULT_PRODUCT_COLOR,
  showLine,
  showProduct = false,
  statusText,
  width,
  xAxis,
  yAxis,
}) {
  const axes = [
    {
      scale: "x",
      label: formatAxisLabel(xAxis),
      labelSize: 18,
      size: X_AXIS_SIZE,
      values: (_plot, ticks) => ticks.map(formatAxisNumber),
    },
    {
      scale: "y",
      label: formatAxisLabel(yAxis),
      labelSize: 18,
      size: Y_AXIS_SIZE,
      values: (_plot, ticks) => ticks.map(formatAxisNumber),
    },
  ];
  const series = [{}, createPointSeries(formatAxisLabel(yAxis), "y", lineColor, showLine)];
  const scales = {
    x: { time: false, range: (_plot, min, max) => paddedValueRange(min, max) },
    y: { range: (_plot, min, max) => paddedValueRange(min, max) },
  };

  if (showProduct) {
    scales.xy = { range: (_plot, min, max) => paddedValueRange(min, max) };
    axes.push({
      scale: "xy",
      side: 1,
      grid: { show: false },
      label: formatAxisLabel(productAxis),
      labelSize: 18,
      size: Y_AXIS_SIZE,
      stroke: productColor,
      values: (_plot, ticks) => ticks.map(formatAxisNumber),
    });
    series.push(
      createPointSeries(formatAxisLabel(productAxis), "xy", productColor, showLine),
    );
  }

  return {
    mode: 2,
    width: width || DEFAULT_CHART_WIDTH,
    height: height || DEFAULT_CHART_HEIGHT,
    class: "psu-uplot",
    cursor: {
      show: true,
      x: true,
      y: true,
      lock: true,
      dataIdx: nearestXyPointIdx,
      bind: {
        dblclick: (_plot, _target, handler) => (event) => {
          onResetZoom?.();
          handler(event);
        },
        mousedown: (_plot, _target, handler) => (event) => {
          if (event.button === 0) {
            onStartZoom?.();
          }
          handler(event);
        },
      },
    },
    legend: { show: false },
    padding: [22, PLOT_PADDING_RIGHT, 4, 4],
    scales,
    axes,
    series,
    hooks: {
      ready: [
        (plot) => {
          plot.root.setAttribute("aria-label", `X-Y chart plot ${statusText}`);
        },
      ],
      setScale: onScaleChange ? [onScaleChange] : [],
      setCursor: onCursorPoint ? [(plot) => onCursorPoint(plot.cursor.idxs?.[1] ?? null)] : [],
    },
  };
}

function createPointSeries(label, yScale, color, showLine) {
  return {
    label,
    facets: [
      { scale: "x", auto: true },
      { scale: yScale, auto: true },
    ],
    stroke: color,
    width: 2,
    paths: showLine ? acquisitionOrderPaths : () => null,
    points: { show: true, size: 6, width: 0, fill: color, stroke: color, paths: acquisitionOrderMarkers },
  };
}

/**
 * Cursor point picker for faceted X-Y data. uPlot's default picker looks up the cursor's X in one shared, sorted X
 * column, which faceted data does not have. This picks the plotted point closest to the cursor on screen, across all
 * series, and returns the same index for every series so the cursor and legend show one point.
 *
 * @param {uPlot} plot
 * @param {number} seriesIdx
 * @returns {number | null}
 */
export function nearestXyPointIdx(plot, seriesIdx) {
  const { left, top } = plot.cursor || {};
  if (seriesIdx === 0 || !Number.isFinite(left) || !Number.isFinite(top) || left < 0 || top < 0) {
    return null;
  }

  const cached = nearestCache.get(plot);
  if (cached && cached.left === left && cached.top === top && cached.data === plot.data) {
    return cached.idx;
  }

  let idx = null;
  let bestDistance = Infinity;
  for (let series = 1; series < plot.series.length; series += 1) {
    const [xValues = [], yValues = []] = plot.data?.[series] || [];
    const yScale = plot.series[series].facets?.[1]?.scale || "y";
    for (let index = 0; index < xValues.length; index += 1) {
      if (xValues[index] == null || yValues[index] == null) {
        continue;
      }

      const dx = plot.valToPos(xValues[index], "x") - left;
      const dy = plot.valToPos(yValues[index], yScale) - top;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        idx = index;
      }
    }
  }

  nearestCache.set(plot, { left, top, data: plot.data, idx });
  return idx;
}

const nearestCache = new WeakMap();

/**
 * Legend rows shared by the on-screen legend and the exported image, laid out like the regular chart's legend: an X
 * row, then the Y line and the optional X·Y line, each with its own value at the same point. As in the regular chart,
 * the label is the axis name and the unit follows the number. The X row uses the Y line's color, since the X values
 * belong to that line.
 *
 * @param {object} params
 * @param {Array<{x: number, y: number}>} params.points
 * @param {number | null} [params.cursorIdx] - Point under (or locked by) the cursor; the latest point when null.
 * @param {{label: string, unit: string}} params.xAxis
 * @param {{label: string, unit: string}} params.yAxis
 * @param {string} params.lineColor
 * @param {boolean} [params.showProduct]
 * @param {{label: string, unit: string}} [params.productAxis]
 * @param {string} [params.productColor]
 * @returns {Array<{color?: string, label: string, value: string}>}
 */
export function createXyLegendRows({
  points,
  cursorIdx = null,
  xAxis,
  yAxis,
  lineColor,
  showProduct = false,
  productAxis = DEFAULT_PRODUCT_AXIS,
  productColor = DEFAULT_PRODUCT_COLOR,
}) {
  const point = cursorIdx != null && points[cursorIdx] ? points[cursorIdx] : points[points.length - 1];
  const rows = [
    { color: lineColor, label: legendLabel(xAxis), value: formatLegendValue(point?.x, xAxis) },
    { color: lineColor, label: legendLabel(yAxis), value: formatLegendValue(point?.y, yAxis) },
  ];

  if (showProduct) {
    rows.push({
      color: productColor,
      label: legendLabel(productAxis),
      value: formatLegendValue(point ? point.x * point.y : null, productAxis),
    });
  }

  return rows;
}

function legendLabel(axis) {
  return String(axis?.label || "").trim();
}

function formatLegendValue(value, axis) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const unit = String(axis?.unit || "").trim();
  return unit ? `${formatAxisNumber(value)} ${unit}` : formatAxisNumber(value);
}
