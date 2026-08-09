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
import { formatInteger } from "./chartStatisticFormatters.js";

/**
 * Sample count statistic.
 *
 * Measures how many valid numeric samples are available for the selected
 * visible chart series. Zero means the series has no finite numeric samples in
 * the current range. This statistic reads `context.count` directly and does not
 * depend on any lazy derived helper.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const countStatistic = Object.freeze({
  id: "count",
  label: "Samples",
  defaultEnabled: false,
  description: {
    title: "Samples",
    summary: "The number of valid numeric samples stored for the selected series.",
    formula: "count = N",
    calculation: [
      "Filter the selected series to samples with numeric time and numeric value fields.",
      "Count the remaining points.",
    ],
  },
  calculate: (context) => context.count,
  formatValue: formatInteger,
});
