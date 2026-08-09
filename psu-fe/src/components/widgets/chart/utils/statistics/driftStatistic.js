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
 * Drift statistic.
 *
 * Measures the total visible value change from first sample to last sample in
 * time order. Zero means the first and last visible samples are equal. Null
 * means there are no samples. This statistic depends on the lazy
 * `context.drift()` helper.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const driftStatistic = Object.freeze({
  id: "drift",
  label: "Drift",
  defaultEnabled: false,
  description: {
    title: "Drift",
    summary: "The total change from the first sample to the last sample in time order.",
    formula: "drift = last value - first value",
    calculation: [
      "Sort the samples by time in ascending order.",
      "Take the last value minus the first value.",
    ],
  },
  calculate: (context) => context.drift(),
  formatValue: formatUnitValue,
});
