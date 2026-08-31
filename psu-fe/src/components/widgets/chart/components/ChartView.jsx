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
import { useEffect, useMemo, useState } from "react";
import { ChartRenderer } from "../renderers/ChartRenderer.jsx";
import {
  computeEnabledChartStatistics,
  getEnabledChartStatistics,
} from "../utils/chartStatistics.js";

const EMPTY_STATISTICS = Object.freeze({ sampleCount: 0, values: Object.freeze({}) });
const EMPTY_POINTS = Object.freeze([]);

/**
 * Source-independent chart presentation. Data sources only need to supply renderer-ready points.
 *
 * @param {object} props
 * @param {{id: string, fileStem: string}} props.chartExport - Runtime export identity and filename source.
 * @param {object} props.config
 * @param {string} props.rendererKey
 * @param {Array<{id: string, label: string, color: string, points: Array<{t: number, y: number}>}>} props.seriesData
 * @param {string} props.statusText
 * @param {string} props.targetText
 * @param {string} props.usageText
 * @returns {import("react").ReactElement}
 */
export function ChartView({
  chartExport,
  config,
  rendererKey,
  seriesData,
  statusText,
  targetText,
  usageText,
}) {
  const [visibleTimeRange, setVisibleTimeRange] = useState(null);
  const firstSeries = config.series[0];
  const statisticsSeriesId = config.statistics.seriesId || firstSeries?.id;
  const statisticsSeries = config.series.find((series) => series.id === statisticsSeriesId) || firstSeries;
  const statisticsSeriesData = seriesData.find((series) => series.id === statisticsSeries?.id);
  const statisticsEnabled = useMemo(
    () => Boolean(config.statistics.showStatistics) && getEnabledChartStatistics(config.statistics.enabledStats).length > 0,
    [config.statistics.enabledStats, config.statistics.showStatistics],
  );
  const statisticsPoints = useMemo(
    () => statisticsEnabled ? filterPointsByVisibleTimeRange(statisticsSeriesData?.points || [], visibleTimeRange) : EMPTY_POINTS,
    [statisticsEnabled, statisticsSeriesData?.points, visibleTimeRange],
  );
  const statistics = useMemo(
    () => statisticsEnabled
      ? computeEnabledChartStatistics(statisticsPoints, config.statistics.enabledStats, { unit: config.unit })
      : EMPTY_STATISTICS,
    [config.statistics.enabledStats, config.unit, statisticsEnabled, statisticsPoints],
  );

  useEffect(() => { setVisibleTimeRange(null); }, [rendererKey]);

  return (
    <ChartRenderer
      key={rendererKey}
      chartExport={chartExport}
      onVisibleTimeRangeChange={setVisibleTimeRange}
      seriesData={seriesData}
      statistics={statistics}
      statisticsConfig={config.statistics}
      statisticsSeries={statisticsSeries}
      statusText={statusText}
      targetText={targetText}
      unit={config.unit}
      usageText={usageText}
    />
  );
}

function filterPointsByVisibleTimeRange(points, visibleTimeRange) {
  if (!Number.isFinite(visibleTimeRange?.minMs) || !Number.isFinite(visibleTimeRange?.maxMs)) return points;
  return points.filter((point) => point.t >= visibleTimeRange.minMs && point.t <= visibleTimeRange.maxMs);
}
