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
import {
  DEFAULT_CHART_HISTORY_LIMIT_BYTES,
  MAX_CHART_HISTORY_BYTES,
} from "../chart/storage/chartHistoryStorage.js";
import {
  createDefaultChartStatisticsConfig,
  normalizeChartStatisticsConfig,
} from "../chart/utils/chartStatistics.js";
import { DEFAULT_PAIR_TIMEOUT_MS } from "./utils/xyPairing.js";

export const XY_CHART_TYPE = "xyChart";
export const XY_AXES = Object.freeze(["x", "y"]);
export const MIN_PAIR_TIMEOUT_MS = 50;
export const MAX_PAIR_TIMEOUT_MS = 10000;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_XY_AXIS_X = Object.freeze({ label: "X", unit: "", deviceName: "", query: "" });
export const DEFAULT_XY_AXIS_Y = Object.freeze({ label: "Y", unit: "", deviceName: "", query: "" });
export const DEFAULT_XY_AXIS_PRODUCT = Object.freeze({ label: "X·Y", unit: "" });

export const DEFAULT_XY_CHART_CONFIG = Object.freeze({
  type: XY_CHART_TYPE,
  cardName: "X-Y Chart",
  frequencyHz: 1,
  pairTimeoutMs: DEFAULT_PAIR_TIMEOUT_MS,
  historyLimitBytes: DEFAULT_CHART_HISTORY_LIMIT_BYTES,
  showLine: true,
  lineColor: "#2563eb",
  showProduct: false,
  productColor: "#dc2626",
  product: DEFAULT_XY_AXIS_PRODUCT,
  x: DEFAULT_XY_AXIS_X,
  y: DEFAULT_XY_AXIS_Y,
  statistics: createDefaultChartStatisticsConfig([{ id: "y" }]),
});

/**
 * @param {string} widgetId
 * @returns {typeof DEFAULT_XY_CHART_CONFIG}
 */
export function loadXyChartConfig(widgetId) {
  return normalizeXyChartConfig(loadStoredWidgetConfig(widgetId));
}

/**
 * Returns the two scheduler subscriptions (X and Y) of every fully configured X-Y chart.
 *
 * @returns {Array<{widgetId: string, deviceName: string, query: string, frequencyHz: number}>}
 */
export function loadRunnableXySubscriptions() {
  return Object.entries(loadStoredWidgetConfigs()).flatMap(([widgetId, config]) => {
    const normalized = normalizeXyChartConfig(config);
    if (!isXyChartConfigured(normalized)) {
      return [];
    }

    return XY_AXES.map((axis) => ({
      widgetId: `${widgetId}:${axis}`,
      deviceName: normalized[axis].deviceName,
      query: normalized[axis].query,
      frequencyHz: normalized.frequencyHz,
    }));
  });
}

/**
 * @param {string} widgetId
 * @param {Partial<typeof DEFAULT_XY_CHART_CONFIG>} config
 * @returns {typeof DEFAULT_XY_CHART_CONFIG}
 */
export function saveXyChartConfig(widgetId, config) {
  const normalized = normalizeXyChartConfig({ ...config, type: XY_CHART_TYPE });
  return saveStoredWidgetConfig(widgetId, normalized);
}

/**
 * @param {string} widgetId
 * @returns {[typeof DEFAULT_XY_CHART_CONFIG, (config: typeof DEFAULT_XY_CHART_CONFIG) => void]}
 */
export function useXyChartConfig(widgetId) {
  return useStoredWidgetConfig(widgetId, loadXyChartConfig);
}

/**
 * @param {typeof DEFAULT_XY_CHART_CONFIG} config
 * @returns {boolean} True when both axes have a device and a valid query.
 */
export function isXyChartConfigured(config) {
  return XY_AXES.every((axis) => Boolean(config[axis]?.deviceName && config[axis]?.query));
}

/**
 * @param {unknown} candidate
 * @returns {typeof DEFAULT_XY_CHART_CONFIG}
 */
export function normalizeXyChartConfig(candidate) {
  if (!candidate || typeof candidate !== "object" || candidate.type !== XY_CHART_TYPE) {
    return cloneDefaultXyChartConfig();
  }

  const config = {
    type: XY_CHART_TYPE,
    cardName: String(candidate.cardName || DEFAULT_XY_CHART_CONFIG.cardName).trim().slice(0, 48),
    frequencyHz: normalizeFrequency(candidate.frequencyHz),
    pairTimeoutMs: normalizeIntegerInRange(
      candidate.pairTimeoutMs,
      DEFAULT_PAIR_TIMEOUT_MS,
      MIN_PAIR_TIMEOUT_MS,
      MAX_PAIR_TIMEOUT_MS,
    ),
    historyLimitBytes: normalizeIntegerInRange(
      candidate.historyLimitBytes,
      DEFAULT_CHART_HISTORY_LIMIT_BYTES,
      1,
      MAX_CHART_HISTORY_BYTES,
    ),
    showLine: candidate.showLine !== false,
    lineColor: normalizeColor(candidate.lineColor, DEFAULT_XY_CHART_CONFIG.lineColor),
    showProduct: candidate.showProduct === true,
    productColor: normalizeColor(candidate.productColor, DEFAULT_XY_CHART_CONFIG.productColor),
    product: normalizeProductAxis(candidate.product),
    x: normalizeAxis(candidate.x, DEFAULT_XY_AXIS_X),
    y: normalizeAxis(candidate.y, DEFAULT_XY_AXIS_Y),
  };

  return {
    ...config,
    statistics: normalizeChartStatisticsConfig(candidate.statistics, getXyStatisticsSeries(config)),
  };
}

/**
 * Lines the statistics panel can summarize, in the order shown in settings. Y comes first and is the default.
 *
 * @param {{x: {label?: string}, y: {label?: string}, product?: {label?: string}, showProduct?: boolean}} config
 * @returns {Array<{id: "x" | "y" | "product", label: string}>}
 */
export function getXyStatisticsSeries(config) {
  const series = [
    { id: "y", label: String(config.y?.label || "").trim() || DEFAULT_XY_AXIS_Y.label },
    { id: "x", label: String(config.x?.label || "").trim() || DEFAULT_XY_AXIS_X.label },
  ];

  if (config.showProduct) {
    series.push({ id: "product", label: String(config.product?.label || "").trim() || DEFAULT_XY_AXIS_PRODUCT.label });
  }

  return series;
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function normalizeIntegerInRange(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeAxis(candidate, fallback) {
  const axis = candidate && typeof candidate === "object" ? candidate : {};
  const query = normalizeScpiQuery(axis.query);

  return {
    label: String(axis.label || fallback.label).trim().slice(0, 48) || fallback.label,
    unit: String(axis.unit || "").trim().slice(0, 16),
    deviceName: String(axis.deviceName || "").trim(),
    query: validateScpiQuery(query) ? "" : query,
  };
}

function normalizeProductAxis(candidate) {
  const axis = candidate && typeof candidate === "object" ? candidate : {};

  return {
    label: String(axis.label || "").trim().slice(0, 48) || DEFAULT_XY_AXIS_PRODUCT.label,
    unit: String(axis.unit || "").trim().slice(0, 16),
  };
}

function normalizeColor(value, fallback) {
  return HEX_COLOR_PATTERN.test(String(value || "")) ? String(value) : fallback;
}

function cloneDefaultXyChartConfig() {
  return {
    ...DEFAULT_XY_CHART_CONFIG,
    product: { ...DEFAULT_XY_AXIS_PRODUCT },
    x: { ...DEFAULT_XY_AXIS_X },
    y: { ...DEFAULT_XY_AXIS_Y },
    statistics: {
      ...DEFAULT_XY_CHART_CONFIG.statistics,
      enabledStats: { ...DEFAULT_XY_CHART_CONFIG.statistics.enabledStats },
    },
  };
}

export const xyChartWidgetConfigSource = {
  loadRunnableSubscriptions: loadRunnableXySubscriptions,
};
