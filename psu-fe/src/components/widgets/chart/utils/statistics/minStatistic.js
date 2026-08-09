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
 * Minimum statistic.
 *
 * Measures the lowest visible sample value. A null value means there are no
 * samples. This statistic depends on the lazy `context.min()` helper.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const minStatistic = Object.freeze({
  id: "min",
  label: "Min",
  defaultEnabled: true,
  description: {
    title: "Min",
    summary: "The lowest stored sample value in the selected series.",
    formula: "min = minimum(sample values)",
    calculation: [
      "Scan all sample values in the selected series.",
      "Keep the smallest value.",
    ],
  },
  calculate: (context) => context.min(),
  formatValue: formatUnitValue,
});
