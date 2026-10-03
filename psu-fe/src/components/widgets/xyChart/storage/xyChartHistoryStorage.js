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
import {
  DEFAULT_CHART_HISTORY_LIMIT_BYTES,
  MAX_CHART_HISTORY_BYTES,
} from "../../chart/storage/chartHistoryStorage.js";

export const XY_CHART_HISTORY_STORAGE_KEY = "psu-ext.xy-chart-history.v1";
export const XY_CHART_HISTORY_CHANGE_EVENT = "psu-ext-xy-chart-history-change";

/**
 * @typedef {{x: number, y: number, t: number}} XyHistoryPoint
 */

/**
 * @typedef {object} XyHistorySourceConfig
 * @property {{deviceName: string, query: string}} x
 * @property {{deviceName: string, query: string}} y
 * @property {number} [historyLimitBytes]
 */

/**
 * Loads the stored points of one X-Y chart. Points recorded for a different X or Y device/query are ignored.
 *
 * @param {string} widgetId
 * @param {XyHistorySourceConfig} config
 * @returns {XyHistoryPoint[]}
 */
export function loadXyChartHistory(widgetId, config) {
  const record = loadXyChartHistories()[widgetId];
  if (!record || !isSameSource(record, config)) {
    return [];
  }

  return normalizePoints(record.points);
}

/**
 * Prunes points to the configured byte cap and stores them, keeping the newest points.
 *
 * @param {string} widgetId
 * @param {XyHistorySourceConfig} config
 * @param {XyHistoryPoint[]} points
 * @returns {XyHistoryPoint[]} The points that were kept.
 */
export function saveXyChartHistory(widgetId, config, points) {
  const kept = pruneXyChartHistory(points, config.historyLimitBytes, config);
  const histories = loadXyChartHistories();
  if (kept.length) {
    histories[widgetId] = buildRecord(kept, config);
  } else {
    delete histories[widgetId];
  }

  window.localStorage.setItem(XY_CHART_HISTORY_STORAGE_KEY, JSON.stringify(histories));
  return kept;
}

/**
 * Removes the stored points of one X-Y chart and tells its mounted card to restart collection.
 *
 * @param {string} widgetId
 */
export function deleteXyChartHistory(widgetId) {
  const histories = loadXyChartHistories();
  if (Object.hasOwn(histories, widgetId)) {
    const { [widgetId]: _removed, ...remaining } = histories;
    window.localStorage.setItem(XY_CHART_HISTORY_STORAGE_KEY, JSON.stringify(remaining));
  }

  window.dispatchEvent(new CustomEvent(XY_CHART_HISTORY_CHANGE_EVENT, { detail: { action: "delete", widgetId } }));
}

/**
 * @param {XyHistorySourceConfig} config
 * @param {XyHistoryPoint[]} points
 * @returns {number} Size of the stored record in bytes.
 */
export function getXyChartHistoryUsageBytes(config, points) {
  return points.length ? measureBytes(buildRecord(points, config)) : 0;
}

/**
 * Drops the oldest points until the stored record fits in `maxBytes`.
 *
 * @param {XyHistoryPoint[]} points
 * @param {number} [maxBytes]
 * @param {XyHistorySourceConfig} config
 * @returns {XyHistoryPoint[]}
 */
export function pruneXyChartHistory(points, maxBytes, config) {
  const byteCap = normalizeByteCap(maxBytes);
  let kept = points;

  while (kept.length && measureBytes(buildRecord(kept, config)) > byteCap) {
    const currentBytes = measureBytes(buildRecord(kept, config));
    const averagePointBytes = Math.max(1, currentBytes / kept.length);
    const removeCount = Math.max(1, Math.ceil((currentBytes - byteCap) / averagePointBytes));
    kept = kept.slice(removeCount);
  }

  return kept;
}

function loadXyChartHistories() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(XY_CHART_HISTORY_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function buildRecord(points, config) {
  return {
    x: { deviceName: config.x.deviceName, query: config.x.query },
    y: { deviceName: config.y.deviceName, query: config.y.query },
    points: points.map(({ x, y, t }) => ({ x, y, t })),
  };
}

function isSameSource(record, config) {
  return ["x", "y"].every(
    (axis) => record[axis]?.deviceName === config[axis].deviceName && record[axis]?.query === config[axis].query,
  );
}

function normalizePoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .map((point) => ({ x: Number(point?.x), y: Number(point?.y), t: Number(point?.t) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.t));
}

function measureBytes(record) {
  return JSON.stringify(record).length;
}

function normalizeByteCap(maxBytes) {
  const parsed = Number.parseInt(String(maxBytes), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CHART_HISTORY_LIMIT_BYTES;
  }

  return Math.min(MAX_CHART_HISTORY_BYTES, Math.max(1, parsed));
}
