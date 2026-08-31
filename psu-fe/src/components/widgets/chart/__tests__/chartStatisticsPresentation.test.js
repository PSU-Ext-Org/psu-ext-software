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
import { describe, expect, it } from "vitest";
import { createChartStatisticsPresentation } from "../utils/chartStatisticsPresentation.js";

describe("chart statistics presentation", () => {
  it("formats only enabled statistics for the selected series", () => {
    expect(createChartStatisticsPresentation({
      statisticsConfig: { showStatistics: true, enabledStats: { min: true, max: false, ripplePeakToPeak: true } },
      statisticsSeries: { label: "Voltage" },
      stats: { sampleCount: 2, values: { min: 12.04, max: 12.24, ripplePeakToPeak: 0.2 } },
      unit: "V",
    })).toEqual({
      title: "Voltage stats",
      rows: [
        { id: "min", label: "Min", value: "12.0400 V" },
        { id: "ripplePeakToPeak", label: "Ripple p-p", value: "0.2000 V" },
      ],
    });
  });

  it("omits hidden statistics and empty sample sets", () => {
    expect(createChartStatisticsPresentation({
      statisticsConfig: { showStatistics: false, enabledStats: { min: true } },
      stats: { sampleCount: 2, values: { min: 12.04 } },
      unit: "V",
    })).toBeNull();
    expect(createChartStatisticsPresentation({
      statisticsConfig: { showStatistics: true, enabledStats: { min: true } },
      stats: { sampleCount: 0, values: {} },
      unit: "V",
    })).toBeNull();
  });
});
