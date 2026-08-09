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
import { formatUnitPerSecond } from "./chartStatisticFormatters.js";

/**
 * Trend-per-second statistic.
 *
 * Measures the slope of a linear regression through visible sample time/value
 * pairs. Null means fewer than two samples are available or the time axis has
 * no usable spread. This statistic depends on the lazy
 * `context.trendPerSecond()` helper.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const trendPerSecondStatistic = Object.freeze({
  id: "trendPerSecond",
  label: "Trend / s",
  defaultEnabled: false,
  description: {
    title: "Trend / s",
    summary: "The slope of the linear regression line through the sample times and sample values.",
    formula: "trend / s = sum((t - avgT) * (value - avgV)) / sum((t - avgT)^2)",
    calculation: [
      "Sort the samples by time in ascending order.",
      "Convert timestamps to seconds.",
      "Calculate the average time avgT and average value avgV.",
      "Compute the regression slope from the centered time and value pairs.",
      "Return the slope in units per second.",
    ],
  },
  calculate: (context) => context.trendPerSecond(),
  formatValue: formatUnitPerSecond,
});
