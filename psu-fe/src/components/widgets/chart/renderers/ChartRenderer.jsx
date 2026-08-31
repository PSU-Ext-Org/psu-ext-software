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
import { ChartRenderer as SelectedChartRenderer } from "psu-chart-renderer";

/**
 * Renderer boundary for chart widgets.
 *
 * Vite aliases `psu-chart-renderer` to the configured implementation.
 *
 * @param {object} props
 * @param {{id: string, fileStem: string}} props.chartExport - Runtime export identity and filename source.
 * @param {ChartSeriesData[]} props.seriesData
 * @param {(visibleTimeRange: {minMs: number, maxMs: number} | null) => void} [props.onVisibleTimeRangeChange]
 * @param {{sampleCount?: number, values?: Record<string, number | null>}} props.statistics
 * @param {{enabledStats?: Record<string, boolean>, showStatistics?: boolean, seriesId?: string}} props.statisticsConfig
 * @param {{id?: string, label?: string} | undefined} props.statisticsSeries
 * @param {string} props.statusText
 * @param {string} props.targetText
 * @param {string} props.usageText
 * @param {string} props.unit
 * @returns {import("react").ReactElement}
 */
export function ChartRenderer(props) {
  return <SelectedChartRenderer {...props} />;
}

/**
 * @typedef {object} ChartPoint
 * @property {number} t
 * @property {number} y
 */

/**
 * @typedef {object} ChartSeriesData
 * @property {string} id
 * @property {string} label
 * @property {string} color
 * @property {ChartPoint[]} points
 */
