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
import { afterEach, describe, expect, it } from "vitest";
import {
  SCRIPT_RESULT_CHART_STATISTICS_STORAGE_KEY,
  loadScriptResultChartStatisticsConfig,
  saveScriptResultChartStatisticsConfig,
} from "../scriptResultChartStatisticsConfig.js";

const SERIES = [{ id: "script-result-voltage", label: "Voltage" }, { id: "script-result-current", label: "Current" }];

describe("script result chart statistics config", () => {
  afterEach(() => window.localStorage.clear());

  it("uses the standard statistics defaults when no preference exists", () => {
    expect(loadScriptResultChartStatisticsConfig(SERIES)).toMatchObject({
      showStatistics: false,
      seriesId: "script-result-voltage",
      enabledStats: { min: true, max: true, ripplePeakToPeak: true },
    });
  });

  it("persists only normalized statistics preferences", () => {
    const saved = saveScriptResultChartStatisticsConfig({
      showStatistics: true,
      seriesId: "script-result-current",
      enabledStats: { avg: true, unknown: true },
    }, SERIES);

    expect(saved).toMatchObject({ showStatistics: true, seriesId: "script-result-current", enabledStats: { avg: true, min: true } });
    expect(JSON.parse(window.localStorage.getItem(SCRIPT_RESULT_CHART_STATISTICS_STORAGE_KEY))).toEqual(saved);
  });

  it("falls back to the first available series and recovers from invalid storage", () => {
    window.localStorage.setItem(SCRIPT_RESULT_CHART_STATISTICS_STORAGE_KEY, JSON.stringify({ showStatistics: true, seriesId: "missing" }));
    expect(loadScriptResultChartStatisticsConfig(SERIES).seriesId).toBe("script-result-voltage");

    window.localStorage.setItem(SCRIPT_RESULT_CHART_STATISTICS_STORAGE_KEY, "not json");
    expect(loadScriptResultChartStatisticsConfig(SERIES).seriesId).toBe("script-result-voltage");
  });
});
