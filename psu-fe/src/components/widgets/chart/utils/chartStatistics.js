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
import { createChartStatisticContext } from "./statistics/chartStatisticContext.js";
import {
  CHART_STATISTICS,
  createDefaultEnabledStats,
  getChartStatistic,
  getEnabledChartStatistics,
} from "./statistics/chartStatisticRegistry.js";

export { CHART_STATISTICS, getChartStatistic, getEnabledChartStatistics };

export const DEFAULT_ENABLED_CHART_STAT_IDS = Object.freeze(
  CHART_STATISTICS.filter((statistic) => statistic.defaultEnabled).map((statistic) => statistic.id),
);

export const CHART_STAT_DEFINITIONS = Object.freeze(
  CHART_STATISTICS.map((statistic) => ({
    id: statistic.id,
    label: statistic.label,
  })),
);

export function createDefaultChartStatisticsConfig(series = []) {
  return {
    showStatistics: false,
    seriesId: series[0]?.id || "",
    enabledStats: createDefaultEnabledStats(),
  };
}

export function normalizeChartStatisticsConfig(candidate, series = []) {
  const defaults = createDefaultChartStatisticsConfig(series);
  const availableSeriesIds = new Set(series.map((item) => item.id));
  const enabledStats = { ...defaults.enabledStats };

  if (candidate && typeof candidate === "object" && candidate.enabledStats && typeof candidate.enabledStats === "object") {
    for (const statistic of CHART_STATISTICS) {
      if (Object.hasOwn(candidate.enabledStats, statistic.id)) {
        enabledStats[statistic.id] = Boolean(candidate.enabledStats[statistic.id]);
      }
    }
  }

  const requestedSeriesId = String(candidate?.seriesId || "").trim();

  return {
    showStatistics: Boolean(candidate?.showStatistics),
    seriesId: availableSeriesIds.has(requestedSeriesId) ? requestedSeriesId : defaults.seriesId,
    enabledStats,
  };
}

/**
 * Calculates only the statistic entities enabled by widget configuration.
 *
 * @param {Array<{t: number, y: number}>} points
 * @param {Record<string, boolean>} [enabledStats]
 * @param {{unit?: string, statistics?: readonly import("./statistics/chartStatisticTypes.js").ChartStatistic[]}} [options]
 * @returns {import("./statistics/chartStatisticTypes.js").ChartStatisticResult}
 */
export function computeEnabledChartStatistics(points, enabledStats = {}, options = {}) {
  const statistics = options.statistics || CHART_STATISTICS;
  const enabledStatistics = getEnabledChartStatistics(enabledStats, statistics);
  const values = {};

  if (!enabledStatistics.length) {
    return {
      sampleCount: countFinitePoints(points),
      values,
    };
  }

  const context = createChartStatisticContext(points, { unit: options.unit });

  for (const statistic of enabledStatistics) {
    values[statistic.id] = statistic.calculate(context);
  }

  return {
    sampleCount: context.count,
    values,
  };
}

/**
 * Compatibility helper that calculates all registered statistics.
 *
 * @param {Array<{t: number, y: number}>} points
 * @returns {Record<string, number | null>}
 */
export function computeTimeSeriesStats(points) {
  const result = computeEnabledChartStatistics(points, createAllEnabledStats());
  return {
    count: result.sampleCount,
    range: result.values.ripplePeakToPeak ?? null,
    ...result.values,
  };
}

export function getEnabledChartStatisticIds(enabledStats = {}) {
  return getEnabledChartStatistics(enabledStats).map((statistic) => statistic.id);
}

export function getChartStatisticDefinition(statId) {
  return getChartStatistic(statId);
}

export function formatChartStatisticValue(statId, value, unit = "") {
  const statistic = getChartStatistic(statId);
  return statistic ? statistic.formatValue(value, { unit }) : "--";
}

function createAllEnabledStats() {
  return Object.fromEntries(CHART_STATISTICS.map((statistic) => [statistic.id, true]));
}

function countFinitePoints(points) {
  let count = 0;
  for (const point of points) {
    if (Number.isFinite(point?.t) && Number.isFinite(point?.y)) {
      count += 1;
    }
  }
  return count;
}
