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
import { describe, expect, it, vi } from "vitest";
import {
  CHART_STATISTICS,
  CHART_STAT_DEFINITIONS,
  computeEnabledChartStatistics,
  computeTimeSeriesStats,
  createDefaultChartStatisticsConfig,
  formatChartStatisticValue,
  normalizeChartStatisticsConfig,
} from "../utils/chartStatistics.js";

describe("chartStatistics", () => {
  it("defines each statistic as a complete unique entity", () => {
    const ids = CHART_STATISTICS.map((statistic) => statistic.id);

    expect(new Set(ids).size).toBe(CHART_STATISTICS.length);
    expect(CHART_STATISTICS).toHaveLength(16);
    for (const statistic of CHART_STATISTICS) {
      expect(statistic).toMatchObject({
        id: expect.any(String),
        label: expect.any(String),
        defaultEnabled: expect.any(Boolean),
        description: {
          title: expect.any(String),
          summary: expect.any(String),
          formula: expect.any(String),
          calculation: expect.any(Array),
        },
        calculate: expect.any(Function),
        formatValue: expect.any(Function),
      });
      expect(statistic.description.calculation.length).toBeGreaterThan(0);
    }
  });

  it("creates default statistics config with min, max, and ripple peak-to-peak enabled", () => {
    expect(createDefaultChartStatisticsConfig([{ id: "voltage" }])).toEqual({
      showStatistics: false,
      seriesId: "voltage",
      enabledStats: {
        count: false,
        avg: false,
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
    });
  });

  it("normalizes malformed or partial statistics config", () => {
    expect(
      normalizeChartStatisticsConfig(
        {
          showStatistics: "yes",
          seriesId: "missing",
          enabledStats: {
            avg: true,
            max: 0,
          },
        },
        [{ id: "voltage" }],
      ),
    ).toEqual({
      showStatistics: true,
      seriesId: "voltage",
      enabledStats: {
        count: false,
        avg: true,
        median: false,
        min: true,
        max: false,
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
    });
  });

  it("returns null metrics and zero counts for empty series", () => {
    expect(computeTimeSeriesStats([])).toEqual({
      count: 0,
      avg: null,
      median: null,
      min: null,
      max: null,
      range: null,
      ripplePeakToPeak: null,
      rippleRms: null,
      typicalRippleP95P5: null,
      stdDev: null,
      maxDelta: null,
      avgDelta: null,
      trendPerSecond: null,
      drift: null,
      spikeCount: 0,
      frequencyHz: null,
      periodSeconds: null,
    });
  });

  it("computes single-point statistics", () => {
    expect(computeTimeSeriesStats([{ t: 1000, y: 12.04 }])).toEqual({
      count: 1,
      avg: 12.04,
      median: 12.04,
      min: 12.04,
      max: 12.04,
      range: 0,
      ripplePeakToPeak: 0,
      rippleRms: 0,
      typicalRippleP95P5: 0,
      stdDev: 0,
      maxDelta: null,
      avgDelta: null,
      trendPerSecond: null,
      drift: 0,
      spikeCount: 0,
      frequencyHz: null,
      periodSeconds: null,
    });
  });

  it("computes multi-point statistics and spike count using the 3x std dev rule", () => {
    const stats = computeTimeSeriesStats([
      { t: 0, y: 0 },
      { t: 1000, y: 0 },
      { t: 2000, y: 0 },
      { t: 3000, y: 10 },
    ]);

    expect(stats.count).toBe(4);
    expect(stats.avg).toBe(2.5);
    expect(stats.median).toBe(0);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(10);
    expect(stats.range).toBe(10);
    expect(stats.ripplePeakToPeak).toBe(10);
    expect(stats.rippleRms).toBe(4.330127018922194);
    expect(stats.stdDev).toBe(4.330127018922194);
    expect(stats.typicalRippleP95P5).toBeCloseTo(8.5);
    expect(stats.maxDelta).toBe(10);
    expect(stats.avgDelta).toBe(10 / 3);
    expect(stats.trendPerSecond).toBe(3);
    expect(stats.drift).toBe(10);
    expect(stats.spikeCount).toBe(0);
    expect(stats.frequencyHz).toBe(null);
    expect(stats.periodSeconds).toBe(null);
  });

  it("calculates only enabled statistic entities", () => {
    const disabledCalculate = vi.fn(() => 1);
    const enabledCalculate = vi.fn(() => 2);
    const result = computeEnabledChartStatistics(
      [{ t: 0, y: 1 }],
      { disabled: false, enabled: true },
      {
        statistics: [
          {
            id: "disabled",
            label: "Disabled",
            defaultEnabled: false,
            description: { title: "", summary: "", formula: "", calculation: [""] },
            calculate: disabledCalculate,
            formatValue: () => "",
          },
          {
            id: "enabled",
            label: "Enabled",
            defaultEnabled: false,
            description: { title: "", summary: "", formula: "", calculation: [""] },
            calculate: enabledCalculate,
            formatValue: () => "",
          },
        ],
      },
    );

    expect(result).toEqual({
      sampleCount: 1,
      values: { enabled: 2 },
    });
    expect(enabledCalculate).toHaveBeenCalledTimes(1);
    expect(disabledCalculate).not.toHaveBeenCalled();
  });

  it("returns a finite sample count without running statistic entities when none are enabled", () => {
    const calculate = vi.fn(() => 1);
    const result = computeEnabledChartStatistics(
      [
        { t: 0, y: 1 },
        { t: 1000, y: 2 },
        { t: Number.NaN, y: 3 },
        { t: 2000, y: "not numeric" },
      ],
      { candidate: false },
      {
        statistics: [
          {
            id: "candidate",
            label: "Candidate",
            defaultEnabled: false,
            description: { title: "", summary: "", formula: "", calculation: [""] },
            calculate,
            formatValue: () => "",
          },
        ],
      },
    );

    expect(result).toEqual({
      sampleCount: 2,
      values: {},
    });
    expect(calculate).not.toHaveBeenCalled();
  });

  it("computes enabled statistics with the refactored result shape", () => {
    const stats = computeEnabledChartStatistics(
      [
        { t: 0, y: 1 },
        { t: 1000, y: 3 },
      ],
      { min: true, max: true, avg: false },
    );

    expect(stats).toEqual({
      sampleCount: 2,
      values: {
        min: 1,
        max: 3,
      },
    });
  });

  it("formats values based on stat type", () => {
    expect(CHART_STAT_DEFINITIONS).toHaveLength(16);
    expect(formatChartStatisticValue("count", 12, "V")).toBe("12");
    expect(formatChartStatisticValue("trendPerSecond", 0.125, "V")).toBe("0.1250 V/s");
    expect(formatChartStatisticValue("frequencyHz", 2.5, "V")).toBe("2.5000 Hz");
    expect(formatChartStatisticValue("periodSeconds", 0.4, "V")).toBe("0.4000 s");
    expect(formatChartStatisticValue("min", 12.04, "V")).toBe("12.0400 V");
    expect(formatChartStatisticValue("avg", null, "V")).toBe("--");
  });
});
