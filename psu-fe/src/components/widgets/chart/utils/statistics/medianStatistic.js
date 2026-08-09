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
 * Median statistic.
 *
 * Measures the middle sample value after sorting the selected visible values.
 * A null value means there are no samples. This statistic depends on the lazy
 * `context.median()` helper.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const medianStatistic = Object.freeze({
  id: "median",
  label: "Median",
  defaultEnabled: false,
  description: {
    title: "Median",
    summary: "The middle sample value after sorting the stored sample values.",
    formula: "median = middle(sorted sample values)",
    calculation: [
      "Sort the sample values from low to high.",
      "Use the middle value when N is odd.",
      "Use the midpoint of the two middle values when N is even.",
    ],
  },
  calculate: (context) => context.median(),
  formatValue: formatUnitValue,
});
