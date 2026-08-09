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
  DEFAULT_CHART_CONFIG,
  loadChartConfig,
  normalizeChartConfig,
  saveChartConfig,
} from "../chartConfig.js";
import { DEFAULT_CHART_HISTORY_LIMIT_BYTES, MAX_CHART_HISTORY_BYTES } from "../storage/chartHistoryStorage.js";

describe("chart config", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("stores independent configs with normalized series", () => {
    saveChartConfig("chart-home-voltage", {
      cardName: "Voltage Trend",
      unit: "V",
      frequencyHz: 2,
      historyLimitBytes: 64 * 1024,
      statistics: {
        showStatistics: true,
        seriesId: "voltage",
        enabledStats: {
          min: true,
          max: true,
          range: true,
          avg: true,
        },
      },
      series: [
        {
          id: "voltage",
          label: "Voltage",
          deviceName: "PSU1",
          query: "MEAS:VOLT? CH1",
          lineColor: "#dc2626",
        },
      ],
    });

    expect(loadChartConfig("chart-home-voltage")).toEqual({
      type: "chart",
      cardName: "Voltage Trend",
      unit: "V",
      frequencyHz: 2,
      historyLimitBytes: 64 * 1024,
      statistics: {
        showStatistics: true,
        seriesId: "voltage",
        enabledStats: {
          count: false,
          avg: true,
          median: false,
          min: true,
          max: true,
          ripplePeakToPeak: true,
          rippleRms: false,
          typicalRippleP95P5: false,
            stdDev: false,
          maxDelta: false,
          avgDelta: false,
          trendPerSecond: false,
          drift: false,
          spikeCount: false,
          frequencyHz: false,
          periodSeconds: false,
        },
      },
      series: [
        {
          id: "voltage",
          label: "Voltage",
          deviceName: "PSU1",
          query: "MEAS:VOLT? CH1",
          lineColor: "#dc2626",
        },
      ],
    });
  });

  it("falls back for malformed records", () => {
    expect(
      normalizeChartConfig({
        type: "chart",
        cardName: "Broken",
        unit: "V",
        frequencyHz: 500,
        series: [
          {
            id: "broken-line",
            label: "Broken Line",
            deviceName: "PSU1",
            query: "OUTP ON",
            lineColor: "red",
          },
        ],
      }),
    ).toEqual({
      ...DEFAULT_CHART_CONFIG,
      cardName: "Broken",
      unit: "V",
      frequencyHz: 100,
      historyLimitBytes: DEFAULT_CHART_HISTORY_LIMIT_BYTES,
      statistics: {
        ...DEFAULT_CHART_CONFIG.statistics,
        seriesId: "broken-line",
      },
      series: [
        {
          id: "broken-line",
          label: "Broken Line",
          deviceName: "PSU1",
          query: "",
          lineColor: "#2563eb",
        },
      ],
    });
  });

  it("clamps history limits to the supported byte range", () => {
    expect(normalizeChartConfig({ type: "chart", historyLimitBytes: MAX_CHART_HISTORY_BYTES * 2 })).toMatchObject({
      historyLimitBytes: MAX_CHART_HISTORY_BYTES,
    });
    expect(normalizeChartConfig({ type: "chart", historyLimitBytes: 0 })).toMatchObject({
      historyLimitBytes: 1,
    });
  });

  it("falls back to the first series when the statistics series id is missing", () => {
    expect(
      normalizeChartConfig({
        type: "chart",
        series: [
          {
            id: "voltage",
            label: "Voltage",
            deviceName: "PSU1",
            query: "MEAS:VOLT? CH1",
            lineColor: "#2563eb",
          },
        ],
        statistics: {
          showStatistics: true,
          seriesId: "current",
          enabledStats: { avg: true },
        },
      }),
    ).toMatchObject({
      statistics: {
        showStatistics: true,
        seriesId: "voltage",
      },
    });
  });
});
