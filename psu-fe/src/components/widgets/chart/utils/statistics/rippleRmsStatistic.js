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
 * RMS ripple statistic.
 *
 * Measures the root mean square magnitude of visible value deviations around
 * the average. Zero means the visible samples do not vary. Null means there
 * are no samples. This statistic depends on the lazy `context.stdDev()` helper.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const rippleRmsStatistic = Object.freeze({
  id: "rippleRms",
  label: "Ripple RMS",
  defaultEnabled: false,
  description: {
    title: "Ripple RMS",
    summary: "The RMS magnitude of the sample-value deviations around the average value.",
    formula: "ripple RMS = sqrt(mean((value - avg)^2))",
    calculation: [
      "Find the average value avg of the selected series.",
      "For each sample, calculate the deviation value - avg.",
      "Square each deviation.",
      "Average those squared deviations.",
      "Take the square root of that average.",
    ],
  },
  calculate: (context) => context.stdDev(),
  formatValue: formatUnitValue,
});
