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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import {
  composeChartPngCanvas,
  createChartPngFileName,
  createUplotCursorOverlay,
  downloadChartPng,
  useRegisterChartImageExport,
} from "../../chart/index.js";
import { XyChartLegend } from "../components/XyChartLegend.jsx";
import { toXyUplotData } from "../utils/xyPlotData.js";
import {
  createXyLegendRows,
  createXyUplotOptions,
  DEFAULT_CHART_HEIGHT,
  DEFAULT_CHART_WIDTH,
  DEFAULT_PRODUCT_AXIS,
  DEFAULT_PRODUCT_COLOR,
} from "../utils/xyUplotOptions.js";

const ZOOM_SCALES = Object.freeze(["x", "y", "xy"]);

/**
 * uPlot renderer for X-Y point data. Uses uPlot's faceted `mode: 2`, so X does not have to be sorted.
 *
 * @param {object} props
 * @param {{id: string, fileStem: string}} [props.chartExport] - Runtime export identity and filename source.
 * @param {Array<{x: number, y: number}>} props.points - Points in acquisition order.
 * @param {{label: string, unit: string}} props.xAxis
 * @param {{label: string, unit: string}} props.yAxis
 * @param {string} props.lineColor
 * @param {boolean} props.showLine - Connect points in acquisition order.
 * @param {boolean} [props.showProduct] - Also plot `x * y` against X on a right-hand axis.
 * @param {{label: string, unit: string}} [props.productAxis]
 * @param {string} [props.productColor]
 * @param {string} props.statusText
 * @param {string} props.targetText
 * @param {string} props.usageText
 * @returns {import("react").ReactElement}
 */
export function XyChartRenderer({
  chartExport,
  points,
  xAxis,
  yAxis,
  lineColor,
  showLine,
  showProduct = false,
  productAxis = DEFAULT_PRODUCT_AXIS,
  productColor = DEFAULT_PRODUCT_COLOR,
  statusText,
  targetText,
  usageText,
}) {
  const rootRef = useRef(null);
  const captureRootRef = useRef(null);
  const plotRef = useRef(null);
  const exportSnapshotRef = useRef(null);
  const zoomRef = useRef({ captureNext: false, suppress: false, ranges: null });
  const [cursorIdx, setCursorIdx] = useState(null);
  const chartData = useMemo(() => toXyUplotData(points, showProduct), [points, showProduct]);
  const chartDataRef = useRef(chartData);
  const hasPoints = chartData.totalPoints > 0;
  const headerText = [targetText, statusText].filter(Boolean).join(" ");
  const optionsKey = [
    xAxis.label,
    xAxis.unit,
    yAxis.label,
    yAxis.unit,
    lineColor,
    showLine,
    showProduct,
    productAxis.label,
    productAxis.unit,
    productColor,
  ].join("|");
  const legendRows = createXyLegendRows({
    points,
    cursorIdx,
    xAxis,
    yAxis,
    lineColor,
    showProduct,
    productAxis,
    productColor,
  });
  chartDataRef.current = chartData;
  exportSnapshotRef.current = {
    fileStem: chartExport?.fileStem,
    headerText,
    legend: { points, xAxis, yAxis, lineColor, showProduct, productAxis, productColor },
    usageText,
  };
  const exportPng = useCallback(async () => {
    const plot = plotRef.current;
    const rootElement = captureRootRef.current;
    const snapshot = exportSnapshotRef.current;
    if (!plot?.ctx?.canvas || !rootElement || !snapshot) {
      throw new Error("Chart is not ready to export.");
    }

    const canvas = composeChartPngCanvas({
      cursorOverlay: createUplotCursorOverlay(plot, rootElement),
      headerText: snapshot.headerText,
      legendRows: createXyLegendRows({
        ...snapshot.legend,
        cursorIdx: plot.cursor?._lock ? (plot.cursor.idxs?.[1] ?? null) : null,
      }),
      plotCanvas: plot.ctx.canvas,
      rootElement,
      statistics: null,
      usageText: snapshot.usageText,
    });
    await downloadChartPng(canvas, createChartPngFileName(snapshot.fileStem));
  }, []);

  useEffect(() => {
    if (!rootRef.current || !hasPoints) {
      return undefined;
    }

    const rootElement = rootRef.current;
    const zoom = zoomRef.current;
    const chart = new uPlot(
      createXyUplotOptions({
        height: rootElement.clientHeight,
        lineColor,
        onResetZoom: () => {
          zoom.captureNext = false;
          zoom.ranges = null;
        },
        onCursorPoint: setCursorIdx,
        onScaleChange: (plot, scaleKey) => captureUserScale(zoom, plot, scaleKey),
        onStartZoom: () => {
          zoom.captureNext = true;
        },
        productAxis,
        productColor,
        showLine,
        showProduct,
        statusText,
        width: rootElement.clientWidth,
        xAxis,
        yAxis,
      }),
      chartDataRef.current.data,
      rootElement,
    );
    plotRef.current = chart;

    const resize = () => {
      chart.setSize({
        width: rootElement.clientWidth || DEFAULT_CHART_WIDTH,
        height: rootElement.clientHeight || DEFAULT_CHART_HEIGHT,
      });
    };
    resize();

    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(rootElement);

    return () => {
      resizeObserver?.disconnect();
      chart.destroy();
      plotRef.current = null;
      setCursorIdx(null);
    };
  }, [hasPoints, optionsKey]);

  useEffect(() => {
    if (plotRef.current && hasPoints) {
      updatePlotData(plotRef.current, zoomRef.current, chartData.data);
    }
  }, [chartData, hasPoints]);

  useEffect(() => {
    plotRef.current?.root?.setAttribute("aria-label", `X-Y chart plot ${statusText}`);
  }, [statusText]);

  useRegisterChartImageExport(chartExport?.id, {
    exportPng,
    ready: hasPoints,
    supported: true,
  });

  if (!hasPoints) {
    return (
      <div className="flex min-h-full flex-col justify-between rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
        <div className="flex min-w-0 justify-between gap-3 text-xs">
          <span className="min-w-0 flex-1 truncate text-slate-600">{headerText}</span>
          <span className="shrink-0 text-slate-500">{usageText}</span>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center">Waiting for paired samples.</div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-md bg-slate-100" data-testid="xy-chart-plot" ref={captureRootRef}>
      <div
        className="pointer-events-none absolute left-3 right-3 top-2 z-10 flex min-w-0 items-center justify-between gap-3 text-xs"
      >
        <span className="min-w-0 flex-1 truncate text-slate-600">{headerText}</span>
        <span className="shrink-0 text-slate-500">{usageText}</span>
      </div>
      <div className="absolute inset-0 overflow-hidden rounded-md pt-1" ref={rootRef} />
      <XyChartLegend rows={legendRows} />
    </div>
  );
}


function captureUserScale(zoom, plot, scaleKey) {
  if (zoom.suppress || !zoom.captureNext || !ZOOM_SCALES.includes(scaleKey)) {
    return;
  }

  const scale = plot.scales?.[scaleKey];
  if (Number.isFinite(scale?.min) && Number.isFinite(scale?.max)) {
    zoom.ranges = { ...zoom.ranges, [scaleKey]: { min: scale.min, max: scale.max } };
  }
}

function updatePlotData(plot, zoom, data) {
  const ranges = zoom.ranges;
  zoom.suppress = true;
  if (!ranges) {
    plot.setData(data);
  } else {
    plot.batch(() => {
      plot.setData(data, false);
      for (const [scaleKey, range] of Object.entries(ranges)) {
        plot.setScale(scaleKey, range);
      }
    });
  }
  zoom.suppress = false;
}
