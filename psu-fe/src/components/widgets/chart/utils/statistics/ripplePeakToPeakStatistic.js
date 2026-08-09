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
 * Peak-to-peak ripple statistic.
 *
 * Measures the spread between the highest and lowest visible sample values.
 * Zero means all visible samples have the same value. Null means there are no
 * samples. This statistic depends on the lazy `context.range()` helper.
 *
 * @type {import("./chartStatisticTypes.js").ChartStatistic}
 */
export const ripplePeakToPeakStatistic = Object.freeze({
  id: "ripplePeakToPeak",
  label: "Ripple p-p",
  defaultEnabled: true,
  description: {
    title: "Ripple p-p",
    summary: "The peak-to-peak spread of the stored sample values in the selected series.",
    formula: "ripple p-p = max - min",
    calculation: [
      "Find the minimum sample value.",
      "Find the maximum sample value.",
      "Subtract min from max.",
    ],
  },
  calculate: (context) => context.range(),
  formatValue: formatUnitValue,
});
