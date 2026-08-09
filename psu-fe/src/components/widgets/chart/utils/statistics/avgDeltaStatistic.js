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
 * Average adjacent-step statistic.
 *
 * Measures the average absolute value jump between adjacent visible samples in
 * time order. Null means there are fewer than two samples. This statistic
 * depends on the lazy `context.avgDelta()` helper.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const avgDeltaStatistic = Object.freeze({
  id: "avgDelta",
  label: "Avg step",
  defaultEnabled: false,
  description: {
    title: "Avg step",
    summary: "The average absolute jump between adjacent samples in time order.",
    formula: "avg step = mean(abs(value[i] - value[i-1]))",
    calculation: [
      "Sort the samples by time in ascending order.",
      "Calculate the absolute value difference for each adjacent sample pair.",
      "Average those adjacent differences.",
    ],
  },
  calculate: (context) => context.avgDelta(),
  formatValue: formatUnitValue,
});
