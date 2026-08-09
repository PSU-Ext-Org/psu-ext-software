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
import { formatHertz } from "./chartStatisticFormatters.js";

/**
 * Frequency statistic.
 *
 * Estimates the fundamental repetition rate of the visible waveform. Null
 * means the visible data is too short, flat, or ambiguous for the period
 * estimator. This statistic depends on the lazy `context.periodStats()` helper,
 * which calls the dedicated autocorrelation estimator only when enabled.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const frequencyStatistic = Object.freeze({
  id: "frequencyHz",
  label: "Frequency",
  defaultEnabled: false,
  description: {
    title: "Frequency",
    summary: "The estimated fundamental repetition rate of the selected series.",
    formula: "frequency = 1 / period",
    calculation: [
      "Sort the samples by time in ascending order.",
      "Resample the values onto an evenly spaced time grid.",
      "Remove the linear trend and normalize the remaining waveform.",
      "Compute autocorrelation across candidate time lags.",
      "Choose the earliest strong autocorrelation peak near the best peak score.",
      "Use the corresponding period to calculate frequency in hertz.",
    ],
  },
  calculate: (context) => context.periodStats().frequencyHz,
  formatValue: formatHertz,
});
