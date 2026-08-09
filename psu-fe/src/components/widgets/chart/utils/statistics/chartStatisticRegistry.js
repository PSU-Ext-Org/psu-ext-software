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
import { averageStatistic } from "./averageStatistic.js";
import { avgDeltaStatistic } from "./avgDeltaStatistic.js";
import { countStatistic } from "./countStatistic.js";
import { driftStatistic } from "./driftStatistic.js";
import { frequencyStatistic } from "./frequencyStatistic.js";
import { maxDeltaStatistic } from "./maxDeltaStatistic.js";
import { maxStatistic } from "./maxStatistic.js";
import { medianStatistic } from "./medianStatistic.js";
import { minStatistic } from "./minStatistic.js";
import { periodStatistic } from "./periodStatistic.js";
import { ripplePeakToPeakStatistic } from "./ripplePeakToPeakStatistic.js";
import { rippleRmsStatistic } from "./rippleRmsStatistic.js";
import { spikeCountStatistic } from "./spikeCountStatistic.js";
import { stdDevStatistic } from "./stdDevStatistic.js";
import { trendPerSecondStatistic } from "./trendPerSecondStatistic.js";
import { typicalRippleP95P5Statistic } from "./typicalRippleP95P5Statistic.js";

/**
 * Ordered chart statistic entities used by settings, rendering, and
 * calculation.
 *
 * @type {readonly import("./chartStatisticTypes.js").ChartStatistic[]}
 */
export const CHART_STATISTICS = Object.freeze([
  countStatistic,
  averageStatistic,
  medianStatistic,
  minStatistic,
  maxStatistic,
  ripplePeakToPeakStatistic,
  rippleRmsStatistic,
  typicalRippleP95P5Statistic,
  stdDevStatistic,
  maxDeltaStatistic,
  avgDeltaStatistic,
  trendPerSecondStatistic,
  driftStatistic,
  spikeCountStatistic,
  frequencyStatistic,
  periodStatistic,
]);

const CHART_STATISTIC_BY_ID = new Map(
  CHART_STATISTICS.map((statistic) => [statistic.id, statistic]),
);

/**
 * Returns a statistic entity by id.
 *
 * @param {string} statId
 * @returns {import("./chartStatisticTypes.js").ChartStatistic | null}
 */
export function getChartStatistic(statId) {
  return CHART_STATISTIC_BY_ID.get(statId) || null;
}

/**
 * Returns statistic entities enabled by a saved enabled-stat map.
 *
 * @param {Record<string, boolean>} [enabledStats]
 * @param {readonly import("./chartStatisticTypes.js").ChartStatistic[]} [statistics]
 * @returns {import("./chartStatisticTypes.js").ChartStatistic[]}
 */
export function getEnabledChartStatistics(enabledStats = {}, statistics = CHART_STATISTICS) {
  return statistics.filter((statistic) => Boolean(enabledStats[statistic.id]));
}

/**
 * Creates the default enabled-stat map from statistic entity metadata.
 *
 * @param {readonly import("./chartStatisticTypes.js").ChartStatistic[]} [statistics]
 * @returns {Record<string, boolean>}
 */
export function createDefaultEnabledStats(statistics = CHART_STATISTICS) {
  return Object.fromEntries(
    statistics.map((statistic) => [statistic.id, Boolean(statistic.defaultEnabled)]),
  );
}
