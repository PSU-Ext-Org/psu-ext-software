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
 * Average statistic.
 *
 * Measures the arithmetic mean of all valid visible sample values. A null value
 * means there are no samples to average. This statistic depends on the lazy
 * `context.average()` helper.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const averageStatistic = Object.freeze({
  id: "avg",
  label: "Average",
  defaultEnabled: false,
  description: {
    title: "Average",
    summary: "The arithmetic mean of the stored sample values in the selected series.",
    formula: "avg = (sum of all sample values) / N",
    calculation: [
      "Sum all sample values in the selected series.",
      "Divide that sum by the sample count N.",
    ],
  },
  calculate: (context) => context.average(),
  formatValue: formatUnitValue,
});
