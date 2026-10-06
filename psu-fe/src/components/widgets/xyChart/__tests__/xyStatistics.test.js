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
import { computeXyStatistics } from "../utils/xyStatistics.js";
import { normalizeXyChartConfig } from "../xyChartConfig.js";

const POINTS = [
  { x: 1, y: 0.1, t: 100 },
  { x: 2, y: 0.4, t: 200 },
  { x: 3, y: 0.5, t: 300 },
];

function createConfig(statistics, overrides = {}) {
  return normalizeXyChartConfig({
    type: "xyChart",
    showProduct: true,
    product: { label: "Power", unit: "W" },
    x: { label: "Voltage", unit: "V", deviceName: "PSU1", query: "MEAS:VOLT? CH1" },
    y: { label: "Current", unit: "A", deviceName: "PSU1", query: "MEAS:CURR? CH1" },
    statistics: { showStatistics: true, enabledStats: { min: true, max: true, count: true }, ...statistics },
    ...overrides,
  });
}

describe("computeXyStatistics", () => {
  it("does not calculate while statistics are off", () => {
    const result = computeXyStatistics({ points: POINTS, config: createConfig({ showStatistics: false }) });

    expect(result.statistics).toBeNull();
    expect(result.statisticsSeries).toEqual({ id: "y", label: "Current" });
  });

  it.each([
    ["y", "Current", "A", 0.1, 0.5],
    ["x", "Voltage", "V", 1, 3],
    ["product", "Power", "W", 0.1, 1.5],
  ])("summarizes the %s line with its own unit", (seriesId, label, unit, min, max) => {
    const result = computeXyStatistics({ points: POINTS, config: createConfig({ seriesId }) });

    expect(result.statisticsSeries).toEqual({ id: seriesId, label });
    expect(result.unit).toBe(unit);
    expect(result.statistics.sampleCount).toBe(3);
    expect(result.statistics.values.min).toBeCloseTo(min);
    expect(result.statistics.values.max).toBeCloseTo(max);
  });

  it("counts only points inside the zoom box of the chosen line", () => {
    const visibleRanges = { x: { min: 1.5, max: 3.5 }, y: { min: 0, max: 0.45 }, xy: { min: 1, max: 2 } };

    const yResult = computeXyStatistics({ points: POINTS, config: createConfig({ seriesId: "y" }), visibleRanges });
    expect(yResult.statistics.sampleCount).toBe(1);
    expect(yResult.statistics.values.max).toBeCloseTo(0.4);

    const productResult = computeXyStatistics({
      points: POINTS,
      config: createConfig({ seriesId: "product" }),
      visibleRanges,
    });
    expect(productResult.statistics.sampleCount).toBe(1);
    expect(productResult.statistics.values.max).toBeCloseTo(1.5);
  });

  it("uses all points when the plot is not zoomed", () => {
    const result = computeXyStatistics({ points: POINTS, config: createConfig({ seriesId: "x" }), visibleRanges: null });

    expect(result.statistics.sampleCount).toBe(3);
  });
});
