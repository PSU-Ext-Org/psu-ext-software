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
export const CHART_HISTORY_STORAGE_KEY = "psu-ext.chart-history.v1";
export const MAX_CHART_HISTORY_BYTES = 256 * 1024;
export const DEFAULT_CHART_HISTORY_LIMIT_BYTES = MAX_CHART_HISTORY_BYTES;

/**
 * @returns {Record<string, unknown>}
 */
export function loadChartHistories() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {string} widgetId
 * @param {{series: Array<{id: string, label: string, lineColor: string, deviceName: string, query: string}>}} config
 * @returns {Array<{id: string, label: string, color: string, points: Array<{t: number, y: number, sourceT?: number}>}>}
 */
export function loadChartHistory(widgetId, config) {
  const record = loadChartHistories()[widgetId];
  return normalizeChartHistoryRecord(record, config);
}

/**
 * @param {string} widgetId
 * @param {{series: Array<{id: string, label: string, lineColor: string, deviceName: string, query: string}>}} config
 * @param {Array<{id: string, label: string, color: string, points: Array<{t: number, y: number, sourceT?: number}>}>} seriesData
 * @returns {Array<{id: string, label: string, color: string, points: Array<{t: number, y: number, sourceT?: number}>}>}
 */
export function saveChartHistory(widgetId, config, seriesData) {
  const histories = loadChartHistories();
  const normalized = pruneChartHistory(
    normalizeSeriesDataForConfig(seriesData, config),
    config.historyLimitBytes,
    config,
  );
  const nextHistories = { ...histories };
  const record = buildChartHistoryRecord(normalized, config);

  if (record) {
    nextHistories[widgetId] = record;
  } else {
    delete nextHistories[widgetId];
  }

  window.localStorage.setItem(CHART_HISTORY_STORAGE_KEY, JSON.stringify(nextHistories));
  return normalized;
}

/**
 * @param {{series: Array<{id: string, label: string, lineColor: string, deviceName: string, query: string}>, historyLimitBytes?: number}} config
 * @param {Array<{id: string, label: string, color: string, points: Array<{t: number, y: number, sourceT?: number}>}>} seriesData
 * @returns {number}
 */
export function getChartHistoryUsageBytes(config, seriesData) {
  return measureChartHistoryRecordBytes(buildChartHistoryRecord(normalizeSeriesDataForConfig(seriesData, config), config));
}

/**
 * @param {number} currentBytes
 * @param {number} maxBytes
 * @returns {string}
 */
export function formatChartHistoryUsage(currentBytes, maxBytes) {
  return `${formatKiB(currentBytes)} / ${formatKiB(maxBytes)} KiB`;
}

/**
 * @param {string} widgetId
 */
export function deleteChartHistory(widgetId) {
  const histories = loadChartHistories();
  if (!Object.hasOwn(histories, widgetId)) {
    return;
  }

  const { [widgetId]: _removed, ...remainingHistories } = histories;
  window.localStorage.setItem(CHART_HISTORY_STORAGE_KEY, JSON.stringify(remainingHistories));
  window.dispatchEvent(
    new CustomEvent("psu-ext-chart-history-change", {
      detail: { action: "delete", widgetId },
    }),
  );
}

/**
 * @param {Array<{id: string, label: string, color: string, points: Array<{t: number, y: number, sourceT?: number}>}>} seriesData
 * @param {number} [maxBytes]
 * @param {{series?: Array<{id: string, label: string, lineColor: string, deviceName: string, query: string}>}} [config]
 * @returns {Array<{id: string, label: string, color: string, points: Array<{t: number, y: number, sourceT?: number}>}>}
 */
export function pruneChartHistory(seriesData, maxBytes = DEFAULT_CHART_HISTORY_LIMIT_BYTES, config) {
  const nextSeriesData = seriesData.map((series) => ({ ...series, points: [...series.points] }));
  const byteCap = normalizeByteCap(maxBytes);

  while (measureSeriesDataBytes(nextSeriesData, config) > byteCap) {
    const totalPoints = countPoints(nextSeriesData);
    if (!totalPoints) {
      break;
    }

    const currentBytes = measureSeriesDataBytes(nextSeriesData, config);
    const averagePointBytes = Math.max(1, currentBytes / totalPoints);
    const removeCount = Math.max(1, Math.ceil((currentBytes - byteCap) / averagePointBytes));
    removeOldestPoints(nextSeriesData, removeCount);
  }

  return nextSeriesData;
}

function removeOldestPoints(seriesData, removeCount) {
  const oldestPoints = seriesData
    .flatMap((series) => series.points.map((point) => ({ seriesId: series.id, t: point.t })))
    .sort((first, second) => first.t - second.t)
    .slice(0, removeCount);
  const removeCountsBySeriesId = oldestPoints.reduce((counts, point) => {
    counts.set(point.seriesId, (counts.get(point.seriesId) || 0) + 1);
    return counts;
  }, new Map());

  for (const series of seriesData) {
    const count = removeCountsBySeriesId.get(series.id) || 0;
    if (count) {
      series.points = series.points.slice(count);
    }
  }
}

function normalizeChartHistoryRecord(record, config) {
  const storedSeries = Array.isArray(record?.series) ? record.series : [];
  return normalizeSeriesDataForConfig(
    config.series.map((configSeries) => {
      const stored = storedSeries.find((series) => series?.id === configSeries.id);
      const compatible =
        stored &&
        stored.deviceName === configSeries.deviceName &&
        stored.query === configSeries.query;

      return {
        id: configSeries.id,
        label: configSeries.label,
        color: configSeries.lineColor,
        points: compatible ? normalizePoints(stored.points) : [],
      };
    }),
    config,
  );
}

function normalizeSeriesDataForConfig(seriesData, config) {
  return config.series.map((configSeries) => {
    const series = seriesData.find((candidate) => candidate.id === configSeries.id);
    return {
      id: configSeries.id,
      label: configSeries.label,
      color: configSeries.lineColor,
      points: normalizePoints(series?.points),
    };
  });
}

function buildChartHistoryRecord(seriesData, config) {
  if (countPoints(seriesData) <= 0) {
    return null;
  }

  return {
    series: seriesData.map((series) => {
      const configSeries = findConfigSeries(config, series.id);
      return {
        id: series.id,
        label: configSeries?.label || series.label,
        color: configSeries?.lineColor || series.color,
        deviceName: configSeries?.deviceName || "",
        query: configSeries?.query || "",
        points: series.points,
      };
    }),
  };
}

function measureChartHistoryRecordBytes(record) {
  return record ? JSON.stringify(record).length : 0;
}

function normalizePoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .map((point) => normalizePoint(point))
    .filter(Boolean)
    .sort((first, second) => first.t - second.t);
}

function normalizePoint(point) {
  const t = Number(point?.t);
  const y = Number(point?.y);
  const sourceT = Number(point?.sourceT);
  if (!Number.isFinite(t) || !Number.isFinite(y)) {
    return null;
  }

  return Number.isFinite(sourceT)
    ? { t, y, sourceT }
    : { t, y };
}

function findConfigSeries(config, seriesId) {
  return config.series.find((series) => series.id === seriesId);
}

function countPoints(seriesData) {
  return seriesData.reduce((total, series) => total + series.points.length, 0);
}

function measureSeriesDataBytes(seriesData, config) {
  return measureChartHistoryRecordBytes(config ? buildChartHistoryRecord(seriesData, config) : { series: seriesData });
}

function normalizeByteCap(maxBytes) {
  const parsed = Number.parseInt(String(maxBytes), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CHART_HISTORY_LIMIT_BYTES;
  }

  return Math.min(MAX_CHART_HISTORY_BYTES, Math.max(1, parsed));
}

function formatKiB(bytes) {
  const kib = bytes / 1024;
  return Number.isInteger(kib) ? String(kib) : kib.toFixed(1);
}
