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
import { formatUnitValue } from "./chartStatisticFormatters.js";

/**
 * Percentile ripple statistic.
 *
 * Measures a typical spread by subtracting the 5th percentile from the 95th
 * percentile. Zero means the percentile spread is zero. Null means there are
 * no samples. This statistic depends on the lazy `context.percentile()` helper.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const typicalRippleP95P5Statistic = Object.freeze({
  id: "typicalRippleP95P5",
  label: "Ripple p95-p5",
  defaultEnabled: false,
  description: {
    title: "Ripple p95-p5",
    summary: "A percentile-based spread that is less sensitive to single outlier samples.",
    formula: "ripple p95-p5 = percentile95(sample values) - percentile5(sample values)",
    calculation: [
      "Sort the sample values from low to high.",
      "Estimate the 95th percentile value.",
      "Estimate the 5th percentile value.",
      "Subtract p5 from p95.",
    ],
  },
  calculate: (context) => {
    const p95 = context.percentile(0.95);
    const p5 = context.percentile(0.05);
    return Number.isFinite(p95) && Number.isFinite(p5) ? p95 - p5 : null;
  },
  formatValue: formatUnitValue,
});
