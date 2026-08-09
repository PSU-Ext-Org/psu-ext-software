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
 * Standard deviation statistic.
 *
 * Measures the population standard deviation of visible sample values. Zero
 * means the visible samples do not vary. Null means there are no samples. This
 * statistic depends on the lazy `context.stdDev()` helper.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const stdDevStatistic = Object.freeze({
  id: "stdDev",
  label: "Std dev",
  defaultEnabled: false,
  description: {
    title: "Std dev",
    summary: "The population standard deviation of the sample values in the selected series.",
    formula: "std dev = sqrt(mean((value - avg)^2))",
    calculation: [
      "Find the average value avg of the selected series.",
      "For each sample, calculate the deviation value - avg.",
      "Square each deviation.",
      "Average those squared deviations across all samples.",
      "Take the square root of that average.",
      "In the current implementation this matches Ripple RMS numerically.",
    ],
  },
  calculate: (context) => context.stdDev(),
  formatValue: formatUnitValue,
});
