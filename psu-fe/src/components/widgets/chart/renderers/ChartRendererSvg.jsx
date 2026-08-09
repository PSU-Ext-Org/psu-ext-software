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
import { useEffect, useMemo } from "react";
import { ChartStatisticsPanel } from "../components/ChartStatisticsPanel.jsx";
import { formatChartTime } from "../utils/chartTimeFormat.js";

const SVG_WIDTH = 640;
const SVG_HEIGHT = 150;
const PLOT = Object.freeze({ left: 42, right: 12, top: 18, bottom: 24 });

/**
 * Lightweight SVG implementation of the chart renderer contract.
 *
 * @param {object} props
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
  const chart = useMemo(() => buildChartGeometry(seriesData), [seriesData]);
  const commandText = [targetText, statusText].filter(Boolean).join(" ");

  useEffect(() => {
    onVisibleTimeRangeChange?.(null);
  }, [onVisibleTimeRangeChange]);

  if (!chart.totalPoints) {
    return (
      <div className="flex min-h-full flex-col justify-between rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-500">
        <div className="flex min-w-0 justify-between gap-3 text-xs">
          <span className="min-w-0 flex-1 truncate text-right text-slate-600">{commandText}</span>
          <span className="shrink-0 text-slate-500">{usageText}</span>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          Waiting for numeric samples.
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-md bg-slate-100" data-testid="chart-plot">
      <svg
        aria-label="Chart plot"
        className="h-full min-h-0 w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      >
        <text fill="#475569" fontSize="11" textAnchor="end" x={chart.right - 120} y="12">
          {commandText}
        </text>
        <text fill="#64748b" fontSize="11" textAnchor="end" x={chart.right} y="12">
          {usageText}
        </text>
        <line x1={PLOT.left} x2={PLOT.left} y1={PLOT.top} y2={chart.bottom} stroke="#cbd5e1" />
        <line x1={PLOT.left} x2={chart.right} y1={chart.bottom} y2={chart.bottom} stroke="#cbd5e1" />
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = PLOT.top + (chart.bottom - PLOT.top) * ratio;
          return <line key={ratio} x1={PLOT.left} x2={chart.right} y1={y} y2={y} stroke="#e2e8f0" />;
        })}
        {chart.series.map((series) => (
          <path
            d={series.path}
            data-testid={`chart-line-${series.id}`}
            fill="none"
            key={series.id}
            stroke={series.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        ))}
        <text fill="#64748b" fontSize="11" x="4" y={PLOT.top + 10}>
          {formatAxisNumber(chart.yMax)}
        </text>
        <text fill="#64748b" fontSize="11" x="4" y={chart.bottom}>
          {formatAxisNumber(chart.yMin)}
        </text>
        <text fill="#64748b" fontSize="11" x={PLOT.left} y={SVG_HEIGHT - 8}>
          {formatChartTime(chart.tMin)}
        </text>
        <text fill="#64748b" fontSize="11" textAnchor="end" x={chart.right} y={SVG_HEIGHT - 8}>
          {formatChartTime(chart.tMax)}
        </text>
        {unit ? (
          <text fill="#475569" fontSize="11" fontWeight="600" textAnchor="end" x={chart.right} y={PLOT.top + 10}>
            {unit}
          </text>
        ) : null}
      </svg>
      <ChartStatisticsPanel
        className="absolute right-3 top-8 z-10 w-max max-w-[calc(100%-1.5rem)]"
        statisticsConfig={statisticsConfig}
        statisticsSeries={statisticsSeries}
        stats={statistics}
        unit={unit}
      />
    </div>
  );
}

function buildChartGeometry(seriesData) {
  const allPoints = seriesData.flatMap((series) => series.points);
  const totalPoints = allPoints.length;
  const right = SVG_WIDTH - PLOT.right;
  const bottom = SVG_HEIGHT - PLOT.bottom;

  if (!totalPoints) {
    return { totalPoints, series: [], right, bottom };
  }

  const rawTMin = Math.min(...allPoints.map((point) => point.t));
  const rawTMax = Math.max(...allPoints.map((point) => point.t));
  const rawYMin = Math.min(...allPoints.map((point) => point.y));
  const rawYMax = Math.max(...allPoints.map((point) => point.y));
  const tPadding = rawTMin === rawTMax ? 1000 : 0;
  const yPadding = rawYMin === rawYMax ? Math.max(Math.abs(rawYMin) * 0.05, 1) : (rawYMax - rawYMin) * 0.08;
  const tMin = rawTMin - tPadding;
  const tMax = rawTMax + tPadding;
  const yMin = rawYMin - yPadding;
  const yMax = rawYMax + yPadding;
  const plotWidth = right - PLOT.left;
  const plotHeight = bottom - PLOT.top;

  return {
    bottom,
    right,
    tMax,
    tMin,
    totalPoints,
    yMax,
    yMin,
    series: seriesData
      .filter((series) => series.points.length)
      .map((series) => ({
        color: series.color,
        id: series.id,
        path: series.points
          .map((point, index) => {
            const x = PLOT.left + ((point.t - tMin) / (tMax - tMin)) * plotWidth;
            const y = PLOT.top + (1 - (point.y - yMin) / (yMax - yMin)) * plotHeight;
            return `${index === 0 ? "M" : "L"} ${roundSvg(x)} ${roundSvg(y)}`;
          })
          .join(" "),
      })),
  };
}

function formatAxisNumber(value) {
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) {
    return value.toExponential(1);
  }

  return String(Number.parseFloat(value.toFixed(2)));
}

function roundSvg(value) {
  return Number.parseFloat(value.toFixed(2));
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
