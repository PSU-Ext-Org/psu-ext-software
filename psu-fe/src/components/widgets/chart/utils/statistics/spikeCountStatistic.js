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
 * Spike count statistic.
 *
 * Counts adjacent visible sample jumps larger than three times the population
 * standard deviation. Zero means no adjacent jump crossed that threshold. This
 * statistic depends on the lazy `context.deltas()` and `context.stdDev()`
 * helpers.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const spikeCountStatistic = Object.freeze({
  id: "spikeCount",
  label: "Spikes",
  defaultEnabled: false,
  description: {
    title: "Spikes",
    summary: "The count of adjacent sample jumps that exceed the fixed spike threshold.",
    formula: "spike count = count(abs(value[i] - value[i-1]) > 3 * std dev)",
    calculation: [
      "Sort the samples by time in ascending order.",
      "Calculate the absolute value jump for each adjacent sample pair.",
      "Calculate the standard deviation of the sample values.",
      "Count adjacent jumps larger than 3 times the standard deviation.",
    ],
  },
  calculate: (context) => {
    const stdDev = context.stdDev();
    const spikeThreshold = Number.isFinite(stdDev) ? stdDev * 3 : null;
    return Number.isFinite(spikeThreshold)
      ? context.deltas().filter((delta) => delta > spikeThreshold).length
      : 0;
  },
  formatValue: formatInteger,
});
