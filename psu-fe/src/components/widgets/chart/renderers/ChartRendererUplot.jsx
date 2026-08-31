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
import { useCallback, useEffect, useMemo, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { ChartStatisticsPanel } from "../components/ChartStatisticsPanel.jsx";
import { useRegisterChartImageExport } from "../export/chartExportRegistry.js";
import {
  composeChartPngCanvas,
  createChartPngFileName,
  createUplotCursorOverlay,
  createUplotLegendRows,
  downloadChartPng,
} from "../export/chartImageExport.js";
import { formatChartTime } from "../utils/chartTimeFormat.js";
import { createChartStatisticsPresentation } from "../utils/chartStatisticsPresentation.js";

const DEFAULT_CHART_WIDTH = 640;
const DEFAULT_CHART_HEIGHT = 150;
const Y_AXIS_SIZE = 58;

/**
 * uPlot implementation of the chart renderer contract.
 *
 * @param {object} props
 * @param {{id: string, fileStem: string}} props.chartExport - Runtime export identity and filename source.
 * @param {ChartSeriesData[]} props.seriesData
 * @param {(visibleTimeRange: {minMs: number, maxMs: number} | null) => void} [props.onVisibleTimeRangeChange]
 * @param {{sampleCount?: number, values?: Record<string, number | null>}} props.statistics
 * @param {{enabledStats?: Record<string, boolean>, showStatistics?: boolean, seriesId?: string}} props.statisticsConfig
 * @param {{id?: string, label?: string} | undefined} props.statisticsSeries
 * @param {string} props.statusText
 * @param {string} props.targetText
 * @param {string} props.usageText
 * @param {string} props.unit
 * @returns {import("react").ReactElement}
 */
export function ChartRenderer({
  chartExport,
  onVisibleTimeRangeChange,
  seriesData,
  statistics,
  statisticsConfig,
  statisticsSeries,
  statusText,
  targetText,
  usageText,
  unit,
}) {
  const { fileStem, id: exportId } = chartExport;
  const rootRef = useRef(null);
  const captureRootRef = useRef(null);
  const plotRef = useRef(null);
  const exportSnapshotRef = useRef(null);
  const captureNextXScaleRef = useRef(false);
  const suppressScaleCaptureRef = useRef(false);
  const xZoomRangeRef = useRef(null);
  const chartData = useMemo(() => toUplotData(seriesData), [seriesData]);
  const hasPoints = chartData.totalPoints > 0;
  const headerText = [targetText, statusText].filter(Boolean).join(" ");
  const seriesKey = useMemo(
    () => seriesData.map((series) => [series.id, series.label, series.color].join("|")).join("||"),
    [seriesData],
  );
  exportSnapshotRef.current = {
    fileStem,
    headerText,
    seriesData,
    statistics,
    statisticsConfig,
    statisticsSeries,
    unit,
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
      legendRows: createUplotLegendRows(plot, snapshot.seriesData),
      plotCanvas: plot.ctx.canvas,
      rootElement,
      statistics: createChartStatisticsPresentation({
        statisticsConfig: snapshot.statisticsConfig,
        statisticsSeries: snapshot.statisticsSeries,
        stats: snapshot.statistics,
        unit: snapshot.unit,
      }),
      usageText: snapshot.usageText,
    });
    await downloadChartPng(canvas, createChartPngFileName(snapshot.fileStem));
  }, []);

  useEffect(() => {
    if (!rootRef.current || !hasPoints) {
      return undefined;
    }

    const rootElement = rootRef.current;
    const chart = new uPlot(
      createUplotOptions({
        height: rootElement.clientHeight,
        onResetZoom: resetStoredZoom,
        onScaleChange: captureUserXScale,
        onStartZoom: () => {
          captureNextXScaleRef.current = true;
        },
        seriesData,
        statusText,
        targetText,
        unit,
        width: rootElement.clientWidth,
      }),
      chartData.data,
      rootElement,
    );
    plotRef.current = chart;

    const resize = () => {
      const width = rootElement.clientWidth || DEFAULT_CHART_WIDTH;
      const height = rootElement.clientHeight || DEFAULT_CHART_HEIGHT;
      chart.setSize({ width, height });
    };
    resize();

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(resize)
        : null;
    resizeObserver?.observe(rootElement);

    return () => {
      resizeObserver?.disconnect();
      chart.destroy();
      plotRef.current = null;
    };
  }, [hasPoints, onVisibleTimeRangeChange, seriesKey, unit]);

  useEffect(() => {
    if (plotRef.current && hasPoints) {
      updatePlotData(plotRef.current, chartData.data);
    }
  }, [chartData, hasPoints]);

  useEffect(() => {
    plotRef.current?.root?.setAttribute("aria-label", `Chart plot ${statusText}`);
  }, [statusText]);

  useEffect(() => {
    if (!hasPoints) {
      onVisibleTimeRangeChange?.(null);
    }
  }, [hasPoints, onVisibleTimeRangeChange]);

  useRegisterChartImageExport(exportId, {
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
        <div className="flex min-h-0 flex-1 items-center justify-center">
          Waiting for numeric samples.
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-md bg-slate-100" data-testid="chart-plot" ref={captureRootRef}>
      <div
        className="pointer-events-none absolute right-3 top-2 z-10 flex min-w-0 items-center justify-end gap-3 text-xs"
        style={{ left: Y_AXIS_SIZE + 8 }}
      >
        <span className="min-w-0 flex-1 truncate text-right text-slate-600">{headerText}</span>
        <span className="shrink-0 text-slate-500">{usageText}</span>
      </div>
      <div className="absolute inset-0 overflow-hidden rounded-md pt-1" ref={rootRef} />
      <ChartStatisticsPanel
        className="pointer-events-none absolute right-3 top-8 z-10 w-max max-w-[calc(100%-1.5rem)]"
        statisticsConfig={statisticsConfig}
        statisticsSeries={statisticsSeries}
        stats={statistics}
        unit={unit}
      />
    </div>
  );

  function captureUserXScale(plot, scaleKey) {
    if (suppressScaleCaptureRef.current || !captureNextXScaleRef.current || scaleKey !== "x") {
      return;
    }

    const scale = plot.scales?.x;
    if (Number.isFinite(scale?.min) && Number.isFinite(scale?.max)) {
      xZoomRangeRef.current = { min: scale.min, max: scale.max };
      onVisibleTimeRangeChange?.({
        minMs: scale.min * 1000,
        maxMs: scale.max * 1000,
      });
    }
    captureNextXScaleRef.current = false;
  }

  function resetStoredZoom() {
    captureNextXScaleRef.current = false;
    xZoomRangeRef.current = null;
    onVisibleTimeRangeChange?.(null);
  }

  function updatePlotData(plot, data) {
    const xZoomRange = xZoomRangeRef.current;
    if (!xZoomRange) {
      suppressScaleCaptureRef.current = true;
      plot.setData(data);
      suppressScaleCaptureRef.current = false;
      return;
    }

    suppressScaleCaptureRef.current = true;
    plot.batch(() => {
      plot.setData(data, false);
      plot.setScale("x", xZoomRange);
    });
    suppressScaleCaptureRef.current = false;
  }
}

export function toUplotData(seriesData) {
  const timestamps = Array.from(
    new Set(seriesData.flatMap((series) => series.points.map((point) => point.t))),
  ).sort((first, second) => first - second);

  return {
    totalPoints: seriesData.reduce((total, series) => total + series.points.length, 0),
    data: [
      timestamps.map((timestamp) => timestamp / 1000),
      ...seriesData.map((series) => alignSeriesValues(series.points, timestamps)),
    ],
  };
}

/**
 * Aligns an irregularly sampled series to the shared chart timeline. Between samples, retain the
 * most recent observed value so each line remains continuous without inventing a future value.
 */
function alignSeriesValues(points, timestamps) {
  const sortedPoints = [...points].sort((first, second) => first.t - second.t);
  let pointIndex = 0;
  let latestValue = null;
  return timestamps.map((timestamp) => {
    while (pointIndex < sortedPoints.length && sortedPoints[pointIndex].t <= timestamp) {
      latestValue = sortedPoints[pointIndex].y;
      pointIndex++;
    }
    return latestValue;
  });
}

export function createUplotOptions({
  height,
  onResetZoom,
  onScaleChange,
  onStartZoom,
  seriesData,
  statusText,
  targetText,
  unit,
  width,
}) {
  return {
    width: width || DEFAULT_CHART_WIDTH,
    height: height || DEFAULT_CHART_HEIGHT,
    class: "psu-uplot",
    cursor: {
      show: true,
      x: true,
      y: true,
      lock: true,
      bind: {
        dblclick: (_plot, target, handler) => {
          return (event) => {
            onResetZoom?.();
            handler(event);
          };
        },
        mousedown: (_plot, target, handler) => {
          return (event) => {
            if (event.button === 0) {
              onStartZoom?.();
            }
            handler(event);
          };
        },
      },
    },
    legend: {
      show: true,
      live: true,
    },
    padding: [22, 10, 10, 4],
    axes: [
      {
        show: false,
        size: 0,
      },
      {
        size: Y_AXIS_SIZE,
        gap: 6,
        values: (_plot, ticks) => ticks.map((tick) => formatNumber(tick)),
      },
    ],
    scales: {
      x: { time: true },
      y: {
        auto: true,
        range: (_plot, min, max) => paddedValueRange(min, max),
      },
    },
    series: [
      {
        label: "T",
        value: (_plot, timestamp) => (timestamp == null ? "--" : formatChartTime(timestamp * 1000)),
      },
      ...seriesData.map((series) => ({
        label: series.label || series.id,
        stroke: series.color,
        width: 2,
        points: { show: false },
        value: (_plot, value) => (value == null ? "--" : `${formatNumber(value)}${unit ? ` ${unit}` : ""}`),
      })),
    ],
    hooks: {
      ready: [
        (plot) => {
          plot.root.setAttribute("aria-label", `Chart plot ${statusText}`);
        },
      ],
      setScale: onScaleChange ? [onScaleChange] : [],
    },
  };
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(4);
}

export function paddedValueRange(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0, 1];
  }

  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.1, 1);
    return [min - padding, max + padding];
  }

  const padding = Math.max((max - min) * 0.12, Math.max(Math.abs(min), Math.abs(max)) * 0.02, 0.0001);
  return [min - padding, max + padding];
}

/**
 * @typedef {object} ChartPoint
 * @property {number} t
 * @property {number} y
 */

/**
 * @typedef {object} ChartSeriesData
 * @property {string} id
 * @property {string} label
 * @property {string} color
 * @property {ChartPoint[]} points
 */
