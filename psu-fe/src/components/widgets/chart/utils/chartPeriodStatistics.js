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
const MIN_POINT_COUNT = 16;
const MIN_RESAMPLED_COUNT = 32;
const MAX_RESAMPLED_COUNT = 512;
const MIN_CANDIDATE_CYCLES = 1.75;
const MIN_LAG_SAMPLES = 3;
const MIN_PEAK_SCORE = 0.28;
const STRONG_PEAK_RATIO = 0.82;
const MIN_PEAK_PROMINENCE = 0.04;

/**
 * Estimates the fundamental period and frequency for a numeric chart series.
 *
 * The estimator resamples irregular chart points, removes a linear trend, and
 * looks for repeated waveform shape with autocorrelation. That makes it less
 * sensitive to signals with several local peaks inside one cycle.
 *
 * @param {Array<{t: number, y: number}>} points
 * @returns {{frequencyHz: number | null, periodSeconds: number | null}}
 */
export function computePeriodStatistics(points) {
  const normalizedPoints = normalizePeriodPoints(points);
  if (normalizedPoints.length < MIN_POINT_COUNT) {
    return createEmptyPeriodStats();
  }

  const durationMs = normalizedPoints.at(-1).t - normalizedPoints[0].t;
  if (!(durationMs > 0)) {
    return createEmptyPeriodStats();
  }

  const resampled = resampleUniform(normalizedPoints);
  if (resampled.length < MIN_RESAMPLED_COUNT) {
    return createEmptyPeriodStats();
  }

  const normalizedValues = normalizeValues(removeLinearTrend(resampled));
  if (!normalizedValues) {
    return createEmptyPeriodStats();
  }

  const autocorrelation = computeAutocorrelation(normalizedValues);
  const bestLag = selectFundamentalLag(autocorrelation);
  if (!bestLag) {
    return createEmptyPeriodStats();
  }

  const periodSeconds = (bestLag * resampled.stepMs) / 1000;
  if (!(periodSeconds > 0)) {
    return createEmptyPeriodStats();
  }

  return {
    frequencyHz: 1 / periodSeconds,
    periodSeconds,
  };
}

function createEmptyPeriodStats() {
  return {
    frequencyHz: null,
    periodSeconds: null,
  };
}

function normalizePeriodPoints(points) {
  return points
    .filter((point) => Number.isFinite(point?.t) && Number.isFinite(point?.y))
    .slice()
    .sort((first, second) => first.t - second.t)
    .filter((point, index, sorted) => index === 0 || point.t > sorted[index - 1].t);
}

function resampleUniform(points) {
  const startMs = points[0].t;
  const endMs = points.at(-1).t;
  const durationMs = endMs - startMs;
  const targetCount = Math.min(
    MAX_RESAMPLED_COUNT,
    Math.max(MIN_RESAMPLED_COUNT, points.length),
  );
  const stepMs = durationMs / (targetCount - 1);
  const values = [];
  let sourceIndex = 0;

  for (let index = 0; index < targetCount; index += 1) {
    const sampleTime = index === targetCount - 1 ? endMs : startMs + index * stepMs;
    while (
      sourceIndex < points.length - 2 &&
      points[sourceIndex + 1].t < sampleTime
    ) {
      sourceIndex += 1;
    }

    const left = points[sourceIndex];
    const right = points[Math.min(sourceIndex + 1, points.length - 1)];
    if (right.t === left.t) {
      values.push(left.y);
      continue;
    }

    const ratio = (sampleTime - left.t) / (right.t - left.t);
    values.push(left.y + (right.y - left.y) * ratio);
  }

  values.stepMs = stepMs;
  return values;
}

function removeLinearTrend(values) {
  const count = values.length;
  const averageIndex = (count - 1) / 2;
  const averageValue = values.reduce((total, value) => total + value, 0) / count;
  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < count; index += 1) {
    const centeredIndex = index - averageIndex;
    numerator += centeredIndex * (values[index] - averageValue);
    denominator += centeredIndex ** 2;
  }

  const slope = denominator ? numerator / denominator : 0;
  const intercept = averageValue - slope * averageIndex;
  const detrended = values.map((value, index) => value - (intercept + slope * index));
  detrended.stepMs = values.stepMs;
  return detrended;
}

function normalizeValues(values) {
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  let varianceSum = 0;

  for (const value of values) {
    varianceSum += (value - average) ** 2;
  }

  const stdDev = Math.sqrt(varianceSum / values.length);
  if (!Number.isFinite(stdDev) || stdDev <= Number.EPSILON) {
    return null;
  }

  return values.map((value) => (value - average) / stdDev);
}

function computeAutocorrelation(values) {
  const maxLag = Math.floor(values.length / MIN_CANDIDATE_CYCLES);
  const autocorrelation = new Array(maxLag + 1).fill(0);

  for (let lag = MIN_LAG_SAMPLES; lag <= maxLag; lag += 1) {
    let numerator = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;

    for (let index = 0; index < values.length - lag; index += 1) {
      const left = values[index];
      const right = values[index + lag];
      numerator += left * right;
      leftEnergy += left ** 2;
      rightEnergy += right ** 2;
    }

    const denominator = Math.sqrt(leftEnergy * rightEnergy);
    autocorrelation[lag] = denominator ? numerator / denominator : 0;
  }

  return autocorrelation;
}

function selectFundamentalLag(autocorrelation) {
  const peaks = findAutocorrelationPeaks(autocorrelation);
  if (!peaks.length) {
    return null;
  }

  const bestScore = Math.max(...peaks.map((peak) => peak.score));
  if (bestScore < MIN_PEAK_SCORE) {
    return null;
  }

  const minimumStrongScore = Math.max(MIN_PEAK_SCORE, bestScore * STRONG_PEAK_RATIO);
  const strongPeaks = peaks.filter((peak) => peak.score >= minimumStrongScore);
  return strongPeaks.length ? strongPeaks[0].lag : null;
}

function findAutocorrelationPeaks(autocorrelation) {
  const peaks = [];

  for (let lag = MIN_LAG_SAMPLES; lag < autocorrelation.length - 1; lag += 1) {
    const previous = autocorrelation[lag - 1];
    const current = autocorrelation[lag];
    const next = autocorrelation[lag + 1];
    if (current <= previous || current < next) {
      continue;
    }

    const prominence = current - Math.max(nearestLeftValley(autocorrelation, lag), nearestRightValley(autocorrelation, lag));
    if (prominence >= MIN_PEAK_PROMINENCE) {
      peaks.push({ lag, score: current, prominence });
    }
  }

  return peaks;
}

function nearestLeftValley(values, peakIndex) {
  let valley = values[peakIndex];

  for (let index = peakIndex - 1; index >= MIN_LAG_SAMPLES; index -= 1) {
    valley = Math.min(valley, values[index]);
    if (values[index] > values[index + 1]) {
      break;
    }
  }

  return valley;
}

function nearestRightValley(values, peakIndex) {
  let valley = values[peakIndex];

  for (let index = peakIndex + 1; index < values.length; index += 1) {
    valley = Math.min(valley, values[index]);
    if (values[index] > values[index - 1]) {
      break;
    }
  }

  return valley;
}
