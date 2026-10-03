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
  computeEnabledChartStatistics,
  getEnabledChartStatistics,
} from "../../chart/utils/chartStatistics.js";
import { getXyStatisticsSeries } from "../xyChartConfig.js";

/**
 * @typedef {{min: number, max: number}} XyScaleRange
 * @typedef {{x?: XyScaleRange, y?: XyScaleRange, xy?: XyScaleRange}} XyVisibleRanges
 */

/**
 * Calculates the regular chart statistics for one line of an X-Y chart.
 *
 * The selected line's values (X, Y or X·Y) are passed to the chart statistics engine as a time series, so every
 * statistic keeps its regular meaning. When the plot is zoomed, only points inside the zoom box on that line count:
 * X and Y use the X and Y scales, X·Y uses the X and X·Y scales.
 *
 * @param {object} params
 * @param {Array<{x: number, y: number, t: number}>} params.points
 * @param {import("../xyChartConfig.js").DEFAULT_XY_CHART_CONFIG} params.config
 * @param {XyVisibleRanges | null} [params.visibleRanges] - Zoomed scale ranges, or null when not zoomed.
 * @returns {{
 *   statistics: {sampleCount: number, values: Record<string, number | null>} | null,
 *   statisticsSeries: {id: string, label: string},
 *   unit: string
 * }}
 */
export function computeXyStatistics({ points, config, visibleRanges = null }) {
  const statisticsSeries = getStatisticsSeries(config);
  const unit = getSeriesUnit(config, statisticsSeries.id);
  const enabled =
    Boolean(config.statistics?.showStatistics) && getEnabledChartStatistics(config.statistics?.enabledStats).length > 0;
  if (!enabled) {
    return { statistics: null, statisticsSeries, unit };
  }

  const valueOf = SERIES_VALUE[statisticsSeries.id];
  const yScale = statisticsSeries.id === "product" ? "xy" : "y";
  const timeSeries = points
    .filter((point) => isVisible(point, yScale, visibleRanges))
    .map((point) => ({ t: point.t, y: valueOf(point) }));

  return {
    statistics: computeEnabledChartStatistics(timeSeries, config.statistics.enabledStats, { unit }),
    statisticsSeries,
    unit,
  };
}

const SERIES_VALUE = Object.freeze({
  x: (point) => point.x,
  y: (point) => point.y,
  product: (point) => point.x * point.y,
});

function getStatisticsSeries(config) {
  const series = getXyStatisticsSeries(config);
  return series.find((item) => item.id === config.statistics?.seriesId) || series[0];
}

function getSeriesUnit(config, seriesId) {
  const axis = seriesId === "product" ? config.product : config[seriesId];
  return String(axis?.unit || "").trim();
}

function isVisible(point, yScale, visibleRanges) {
  if (!visibleRanges) {
    return true;
  }

  const plottedY = yScale === "xy" ? point.x * point.y : point.y;
  return inRange(point.x, visibleRanges.x) && inRange(plottedY, visibleRanges[yScale]);
}

function inRange(value, range) {
  return !range || (value >= range.min && value <= range.max);
}
