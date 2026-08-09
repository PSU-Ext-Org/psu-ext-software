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
import { computePeriodStatistics } from "../chartPeriodStatistics.js";

/**
 * Creates a lazy calculation context for enabled chart statistic entities.
 *
 * @param {Array<{t: number, y: number}>} points
 * @param {{unit?: string}} [options]
 * @returns {import("./chartStatisticTypes.js").ChartStatisticContext}
 */
export function createChartStatisticContext(points, options = {}) {
  const normalizedPoints = normalizeStatisticPoints(points);
  const values = normalizedPoints.map((point) => point.y);
  const cache = new Map();

  return {
    points: normalizedPoints,
    values,
    count: values.length,
    unit: String(options.unit || ""),
    min: () => cached(cache, "min", () => (values.length ? minValue(values) : null)),
    max: () => cached(cache, "max", () => (values.length ? maxValue(values) : null)),
    average: () => cached(cache, "average", () => (values.length ? sumValues(values) / values.length : null)),
    median: () => cached(cache, "median", () => percentile(values, 0.5)),
    percentile: (ratio) => percentile(values, ratio),
    range: () => cached(cache, "range", () => {
      const min = cache.has("min") ? cache.get("min") : (values.length ? minValue(values) : null);
      const max = cache.has("max") ? cache.get("max") : (values.length ? maxValue(values) : null);
      return Number.isFinite(min) && Number.isFinite(max) ? max - min : null;
    }),
    stdDev: () => cached(cache, "stdDev", () => computeStdDev(values)),
    deltas: () => cached(cache, "deltas", () => computeDeltas(values)),
    maxDelta: () => cached(cache, "maxDelta", () => {
      const deltas = cached(cache, "deltas", () => computeDeltas(values));
      return deltas.length ? maxValue(deltas) : null;
    }),
    avgDelta: () => cached(cache, "avgDelta", () => {
      const deltas = cached(cache, "deltas", () => computeDeltas(values));
      return deltas.length ? sumValues(deltas) / deltas.length : null;
    }),
    trendPerSecond: () => cached(cache, "trendPerSecond", () => computeTrendPerSecond(normalizedPoints)),
    drift: () => cached(cache, "drift", () => (values.length ? values.at(-1) - values[0] : null)),
    periodStats: () => cached(cache, "periodStats", () => computePeriodStatistics(normalizedPoints)),
  };
}

/**
 * Normalizes raw chart points into finite points sorted by time.
 *
 * @param {Array<{t: number, y: number}>} points
 * @returns {Array<{t: number, y: number}>}
 */
export function normalizeStatisticPoints(points) {
  return points
    .filter((point) => Number.isFinite(point?.t) && Number.isFinite(point?.y))
    .slice()
    .sort((first, second) => first.t - second.t);
}

function cached(cache, key, compute) {
  if (!cache.has(key)) {
    cache.set(key, compute());
  }

  return cache.get(key);
}

function minValue(values) {
  let min = values[0];
  for (const value of values) {
    if (value < min) {
      min = value;
    }
  }
  return min;
}

function maxValue(values) {
  let max = values[0];
  for (const value of values) {
    if (value > max) {
      max = value;
    }
  }
  return max;
}

function sumValues(values) {
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum;
}

function computeStdDev(values) {
  if (!values.length) {
    return null;
  }

  const average = sumValues(values) / values.length;
  let varianceSum = 0;
  for (const value of values) {
    varianceSum += (value - average) ** 2;
  }

  return Math.sqrt(varianceSum / values.length);
}

function computeDeltas(values) {
  const deltas = [];
  for (let index = 1; index < values.length; index += 1) {
    deltas.push(Math.abs(values[index] - values[index - 1]));
  }
  return deltas;
}

function percentile(values, ratio) {
  if (!values.length) {
    return null;
  }

  if (values.length === 1) {
    return values[0];
  }

  const sorted = values.slice().sort((first, second) => first - second);
  const position = (sorted.length - 1) * ratio;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const weight = position - lowerIndex;
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * weight;
}

function computeTrendPerSecond(points) {
  if (points.length < 2) {
    return null;
  }

  const times = points.map((point) => point.t / 1000);
  const values = points.map((point) => point.y);
  const averageTime = sumValues(times) / times.length;
  const averageValue = sumValues(values) / values.length;
  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < times.length; index += 1) {
    const centeredTime = times[index] - averageTime;
    const centeredValue = values[index] - averageValue;
    numerator += centeredTime * centeredValue;
    denominator += centeredTime ** 2;
  }

  return denominator ? numerator / denominator : null;
}
