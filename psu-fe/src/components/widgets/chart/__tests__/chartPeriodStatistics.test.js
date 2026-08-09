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
import { computePeriodStatistics } from "../utils/chartPeriodStatistics.js";

describe("chartPeriodStatistics", () => {
  it("estimates frequency and period for a clean periodic waveform", () => {
    const points = createWavePoints({
      durationSeconds: 6,
      frequencyHz: 2,
      sampleRateHz: 80,
      valueAt: (phase) => Math.sin(phase),
    });

    const stats = computePeriodStatistics(points);

    expect(stats.frequencyHz).toBeCloseTo(2, 1);
    expect(stats.periodSeconds).toBeCloseTo(0.5, 1);
  });

  it("uses repeated waveform shape instead of local peak spacing", () => {
    const points = createWavePoints({
      durationSeconds: 8,
      frequencyHz: 1.25,
      sampleRateHz: 100,
      valueAt: (phase) => Math.sin(phase) + 0.38 * Math.sin(phase * 3 + 0.35),
    });

    const stats = computePeriodStatistics(points);

    expect(stats.frequencyHz).toBeCloseTo(1.25, 1);
    expect(stats.periodSeconds).toBeCloseTo(0.8, 1);
  });

  it("returns null values for flat data", () => {
    const points = Array.from({ length: 80 }, (_item, index) => ({
      t: index * 100,
      y: 12,
    }));

    expect(computePeriodStatistics(points)).toEqual({
      frequencyHz: null,
      periodSeconds: null,
    });
  });

  it("returns null values for insufficient data", () => {
    expect(computePeriodStatistics([{ t: 0, y: 1 }, { t: 1000, y: 2 }])).toEqual({
      frequencyHz: null,
      periodSeconds: null,
    });
  });
});

function createWavePoints({ durationSeconds, frequencyHz, sampleRateHz, valueAt }) {
  const count = Math.floor(durationSeconds * sampleRateHz);

  return Array.from({ length: count }, (_item, index) => {
    const seconds = index / sampleRateHz;
    return {
      t: seconds * 1000,
      y: valueAt(2 * Math.PI * frequencyHz * seconds),
    };
  });
}
