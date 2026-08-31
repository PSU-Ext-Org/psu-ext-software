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
import { getEnabledChartStatistics } from "./chartStatistics.js";

/**
 * Builds the formatted statistics presentation shared by HTML and PNG renderers.
 *
 * @param {object} params
 * @param {{enabledStats?: Record<string, boolean>, showStatistics?: boolean} | undefined} params.statisticsConfig
 * @param {{label?: string} | undefined} params.statisticsSeries
 * @param {{sampleCount?: number, count?: number, values?: Record<string, number | null>} | undefined} params.stats
 * @param {string} params.unit
 * @returns {{title: string, rows: Array<{id: string, label: string, value: string}>} | null}
 */
export function createChartStatisticsPresentation({ statisticsConfig, statisticsSeries, stats, unit }) {
  const enabledStatistics = getEnabledChartStatistics(statisticsConfig?.enabledStats);
  const sampleCount = stats?.sampleCount ?? stats?.count ?? 0;
  const values = stats?.values || stats || {};
  if (!statisticsConfig?.showStatistics || !sampleCount || !enabledStatistics.length) return null;

  return {
    title: statisticsSeries?.label ? `${statisticsSeries.label} stats` : "Statistics",
    rows: enabledStatistics.map((statistic) => ({
      id: statistic.id,
      label: statistic.label,
      value: statistic.formatValue(values[statistic.id], { unit }),
    })),
  };
}
