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
import { formatSeconds } from "./chartStatisticFormatters.js";

/**
 * Period statistic.
 *
 * Estimates the fundamental time between repeated visible waveform cycles.
 * Null means the visible data is too short, flat, or ambiguous for the period
 * estimator. This statistic depends on the lazy `context.periodStats()` helper,
 * which calls the dedicated autocorrelation estimator only when enabled.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const periodStatistic = Object.freeze({
  id: "periodSeconds",
  label: "Period",
  defaultEnabled: false,
  description: {
    title: "Period",
    summary: "The estimated fundamental time between repeated waveform cycles.",
    formula: "period = autocorrelation peak lag * sample interval",
    calculation: [
      "Sort the samples by time in ascending order.",
      "Resample the values onto an evenly spaced time grid.",
      "Remove the linear trend and normalize the remaining waveform.",
      "Compute autocorrelation so repeated waveform shape is measured instead of raw local peak spacing.",
      "Choose the earliest strong autocorrelation peak near the best peak score.",
      "Return the period in seconds, or no value when the signal is too short, flat, or ambiguous.",
    ],
  },
  calculate: (context) => context.periodStats().periodSeconds,
  formatValue: formatSeconds,
});
