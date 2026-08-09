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
import { useEffect, useState } from "react";
import { DEFAULT_CHART_HISTORY_LIMIT_BYTES, formatChartHistoryUsage, pruneChartHistory } from "../storage/chartHistoryStorage.js";

const PAGE_LIMIT = 1024;

/**
 * Loads a completed Script Runner series through bounded JSON pages. Only the newest configured
 * chart-history budget remains in React state; endpoint responses are discarded page by page.
 *
 * @param {{seriesUrl?: string, series: {id: string, label: string, lineColor: string, seriesUrl?: string} | Array<{id: string, label: string, lineColor: string, seriesUrl: string}>, historyLimitBytes?: number}} params
 * @returns {{rendererKey: string, seriesData: Array, statusText: string, usageText: string, unit: string}}
 */
export function useScriptResultSeriesData({ seriesUrl, series, historyLimitBytes = DEFAULT_CHART_HISTORY_LIMIT_BYTES }) {
  const seriesDefinitions = normalizeSeriesDefinitions(series, seriesUrl);
  const seriesKey = seriesDefinitions.map((definition) => [definition.id, definition.label, definition.lineColor, definition.seriesUrl].join("|")).join("||");
  const [state, setState] = useState(() => emptyState(seriesDefinitions, historyLimitBytes));

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState(emptyState(seriesDefinitions, historyLimitBytes));

    async function load() {
      try {
        const loaded = await Promise.all(seriesDefinitions.map((definition) => loadSeries(definition, historyLimitBytes, controller.signal)));
        if (active) setState(readyState(loaded, historyLimitBytes));
      } catch (error) {
        if (active && error.name !== "AbortError") {
          setState((current) => ({ ...current, statusText: error.message || "Could not load result series." }));
        }
      }
    }

    load();
    return () => { active = false; controller.abort(); };
  }, [historyLimitBytes, seriesKey]);

  return state;
}

function emptyState(seriesDefinitions, historyLimitBytes) {
  return {
    rendererKey: `${seriesDefinitions.map((series) => series.id).join(":")}:loading`,
    seriesData: seriesDefinitions.map(emptySeriesData),
    statusText: "Loading result series",
    unit: "",
    usageText: formatChartHistoryUsage(0, historyLimitBytes),
  };
}

function readyState(loaded, historyLimitBytes) {
  const seriesData = loaded.map((entry) => entry.seriesData);
  const loadedCount = loaded.reduce((total, entry) => total + entry.loadedCount, 0);
  const retainedCount = seriesData.reduce((total, entry) => total + entry.points.length, 0);
  const units = [...new Set(loaded.map((entry) => entry.unit).filter(Boolean))];
  return {
    rendererKey: `${seriesData.map((entry) => `${entry.id}:${entry.points.length}`).join("|")}:${loadedCount}`,
    seriesData,
    statusText: `Loaded ${loadedCount} point${loadedCount === 1 ? "" : "s"}`,
    unit: units.length === 1 ? units[0] : "",
    usageText: `${formatChartHistoryUsage(measureSeriesDataBytes(seriesData), historyLimitBytes * seriesData.length)}${retainedCount < loadedCount ? `, latest ${retainedCount} shown` : ""} (${formatChartHistoryUsage(historyLimitBytes, historyLimitBytes)} per series)`,
  };
}

function emptySeriesData(series) {
  return { id: series.id, label: series.label, color: series.lineColor, points: [] };
}

async function loadSeries(series, historyLimitBytes, signal) {
  let offset = 0;
  let seriesData = emptySeriesData(series);
  let unit = "";
  let loadedCount = 0;
  while (!signal.aborted) {
    const response = await fetch(`${series.seriesUrl}&offset=${offset}&limit=${PAGE_LIMIT}`, {
      headers: { Accept: "application/json" },
      signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `Series unavailable (HTTP ${response.status}).`);
    if (payload?.unit != null) unit = String(payload.unit);
    const page = normalizeResultPoints(payload?.points);
    loadedCount += page.length;
    seriesData = retainLatestResultSeriesData([{ ...seriesData, points: [...seriesData.points, ...page] }], historyLimitBytes)[0];
    const received = Array.isArray(payload?.points) ? payload.points.length : 0;
    if (received < PAGE_LIMIT) break;
    offset += received;
  }
  return { loadedCount, seriesData, unit };
}

function normalizeSeriesDefinitions(series, seriesUrl) {
  const candidates = Array.isArray(series) ? series : [series];
  return candidates.map((candidate) => ({ ...candidate, seriesUrl: candidate.seriesUrl || seriesUrl }));
}

/** Keeps endpoint-derived points within the chart's standard latest-history budget. */
export function retainLatestResultSeriesData(seriesData, historyLimitBytes = DEFAULT_CHART_HISTORY_LIMIT_BYTES) {
  return pruneChartHistory(seriesData, historyLimitBytes);
}

function normalizeResultPoints(points) {
  if (!Array.isArray(points)) return [];
  return points.map((point) => {
    const t = timestampToMilliseconds(point?.timestamp);
    const y = Number(point?.value);
    return Number.isFinite(t) && Number.isFinite(y) ? { t, y } : null;
  }).filter(Boolean);
}

function timestampToMilliseconds(timestamp) {
  const numeric = Number(timestamp);
  if (Number.isFinite(numeric)) {
    // Jackson may serialize Instant either as ISO-8601 text or epoch seconds with a fractional part.
    // Epoch milliseconds are also accepted for compatibility with chart-style timestamps.
    return Math.abs(numeric) < 100_000_000_000 ? numeric * 1000 : numeric;
  }
  return Date.parse(timestamp);
}

function measureSeriesDataBytes(seriesData) {
  return new TextEncoder().encode(JSON.stringify({ series: seriesData })).byteLength;
}
