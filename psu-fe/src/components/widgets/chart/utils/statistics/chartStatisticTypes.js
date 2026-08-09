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
/**
 * Describes how a chart statistic is explained in the settings info dialog.
 *
 * @typedef {object} ChartStatisticDescription
 * @property {string} title
 * @property {string} summary
 * @property {string} formula
 * @property {string[]} calculation
 */

/**
 * Context passed to each statistic formatter.
 *
 * @typedef {object} ChartStatisticFormatContext
 * @property {string} unit
 */

/**
 * A dedicated chart statistic entity.
 *
 * Each statistic owns its metadata, help text, formatting, and calculation.
 * The chart widget calls `calculate()` only when the statistic is enabled in
 * widget configuration.
 *
 * @typedef {object} ChartStatistic
 * @property {string} id
 * @property {string} label
 * @property {boolean} defaultEnabled
 * @property {ChartStatisticDescription} description
 * @property {(context: ChartStatisticContext) => number | null} calculate
 * @property {(value: number | null, context: ChartStatisticFormatContext) => string} formatValue
 */

/**
 * Lazily computed shared data for chart statistic entities.
 *
 * Expensive derived values are cached by helper methods. Shared preprocessing
 * such as sorting and filtering points is done once before enabled statistic
 * entities run.
 *
 * @typedef {object} ChartStatisticContext
 * @property {Array<{t: number, y: number}>} points
 * @property {number[]} values
 * @property {number} count
 * @property {string} unit
 * @property {() => number | null} min
 * @property {() => number | null} max
 * @property {() => number | null} average
 * @property {() => number | null} median
 * @property {(ratio: number) => number | null} percentile
 * @property {() => number | null} range
 * @property {() => number | null} stdDev
 * @property {() => number[]} deltas
 * @property {() => number | null} maxDelta
 * @property {() => number | null} avgDelta
 * @property {() => number | null} trendPerSecond
 * @property {() => number | null} drift
 * @property {() => {frequencyHz: number | null, periodSeconds: number | null}} periodStats
 */

/**
 * Calculated chart statistics keyed by statistic id.
 *
 * @typedef {object} ChartStatisticResult
 * @property {number} sampleCount
 * @property {Record<string, number | null>} values
 */

export {};
