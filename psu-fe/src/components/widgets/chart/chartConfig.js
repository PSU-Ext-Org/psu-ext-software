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
  normalizeScpiQuery,
  validateScpiQuery,
} from "../../../connection/ws-proxy/scpi/scpiQueryValidation.js";
import { normalizeFrequency } from "../singleValue/singleValueConfig.js";
import {
  loadStoredWidgetConfig,
  loadStoredWidgetConfigs,
  saveStoredWidgetConfig,
  useStoredWidgetConfig,
} from "../widgetConfigStore.js";
import { DEFAULT_CHART_HISTORY_LIMIT_BYTES, MAX_CHART_HISTORY_BYTES } from "./storage/chartHistoryStorage.js";
import { createDefaultChartStatisticsConfig, normalizeChartStatisticsConfig } from "./utils/chartStatistics.js";

export const DEFAULT_CHART_SERIES = Object.freeze({
  id: "series-1",
  label: "Series 1",
  deviceName: "",
  query: "",
  lineColor: "#2563eb",
});

export const DEFAULT_CHART_CONFIG = Object.freeze({
  type: "chart",
  cardName: "Chart",
  unit: "",
  frequencyHz: 1,
  historyLimitBytes: DEFAULT_CHART_HISTORY_LIMIT_BYTES,
  series: [DEFAULT_CHART_SERIES],
  statistics: createDefaultChartStatisticsConfig([DEFAULT_CHART_SERIES]),
});

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * @param {string} widgetId
 * @returns {typeof DEFAULT_CHART_CONFIG}
 */
export function loadChartConfig(widgetId) {
  return normalizeChartConfig(loadStoredWidgetConfig(widgetId));
}

/**
 * @returns {Array<{widgetId: string, seriesId: string, deviceName: string, query: string, frequencyHz: number}>}
 */
export function loadRunnableChartSubscriptions() {
  return Object.entries(loadStoredWidgetConfigs()).flatMap(([widgetId, config]) => {
    const normalized = normalizeChartConfig(config);
    if (normalized.type !== "chart") {
      return [];
    }

    return normalized.series
      .filter((series) => series.deviceName && series.query)
      .map((series) => ({
        widgetId: `${widgetId}:${series.id}`,
        seriesId: series.id,
        deviceName: series.deviceName,
        query: series.query,
        frequencyHz: normalized.frequencyHz,
      }));
  });
}

/**
 * @param {string} widgetId
 * @param {Partial<typeof DEFAULT_CHART_CONFIG>} config
 * @returns {typeof DEFAULT_CHART_CONFIG}
 */
export function saveChartConfig(widgetId, config) {
  const normalized = normalizeChartConfig({ ...config, type: "chart" });
  return saveStoredWidgetConfig(widgetId, normalized);
}

/**
 * @param {string} widgetId
 * @returns {[typeof DEFAULT_CHART_CONFIG, (config: typeof DEFAULT_CHART_CONFIG) => void]}
 */
export function useChartConfig(widgetId) {
  return useStoredWidgetConfig(widgetId, loadChartConfig);
}

/**
 * @param {unknown} candidate
 * @returns {typeof DEFAULT_CHART_CONFIG}
 */
export function normalizeChartConfig(candidate) {
  if (!candidate || typeof candidate !== "object" || candidate.type !== "chart") {
    return cloneDefaultChartConfig();
  }

  const series = Array.isArray(candidate.series)
    ? candidate.series.map((item, index) => normalizeChartSeries(item, index)).filter(Boolean)
    : [];

  return {
    type: "chart",
    cardName: String(candidate.cardName || DEFAULT_CHART_CONFIG.cardName).trim().slice(0, 48),
    unit: String(candidate.unit || "").trim().slice(0, 16),
    frequencyHz: normalizeFrequency(candidate.frequencyHz),
    historyLimitBytes: normalizeHistoryLimitBytes(candidate.historyLimitBytes),
    series: series.length ? series : [{ ...DEFAULT_CHART_SERIES }],
    statistics: normalizeChartStatisticsConfig(candidate.statistics, series.length ? series : [{ ...DEFAULT_CHART_SERIES }]),
  };
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeHistoryLimitBytes(value) {
  if (value == null || value === "") {
    return DEFAULT_CHART_HISTORY_LIMIT_BYTES;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CHART_HISTORY_LIMIT_BYTES;
  }

  return Math.min(MAX_CHART_HISTORY_BYTES, Math.max(1, parsed));
}

function normalizeChartSeries(candidate, index) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const query = normalizeScpiQuery(candidate.query);
  const lineColor = HEX_COLOR_PATTERN.test(String(candidate.lineColor || ""))
    ? String(candidate.lineColor)
    : DEFAULT_CHART_SERIES.lineColor;
  const fallbackId = index === 0 ? DEFAULT_CHART_SERIES.id : `series-${index + 1}`;

  return {
    id: String(candidate.id || fallbackId).trim().slice(0, 48) || fallbackId,
    label: String(candidate.label || `Series ${index + 1}`).trim().slice(0, 48) || `Series ${index + 1}`,
    deviceName: String(candidate.deviceName || "").trim(),
    query: validateScpiQuery(query) ? "" : query,
    lineColor,
  };
}

function cloneDefaultChartConfig() {
  return {
    ...DEFAULT_CHART_CONFIG,
    series: DEFAULT_CHART_CONFIG.series.map((series) => ({ ...series })),
    statistics: {
      ...DEFAULT_CHART_CONFIG.statistics,
      enabledStats: { ...DEFAULT_CHART_CONFIG.statistics.enabledStats },
    },
  };
}

export const chartWidgetConfigSource = {
  loadRunnableSubscriptions: loadRunnableChartSubscriptions,
};
