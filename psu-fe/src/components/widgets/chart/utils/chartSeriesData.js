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
/**
 * @param {ChartSeriesData[]} seriesData
 * @param {{id: string, label: string, lineColor: string}} series
 * @param {ChartPoint[]} points
 * @returns {ChartSeriesData[]}
 */
export function mergeSeriesPoints(seriesData, series, points) {
  const nextSeriesData = seriesData.some((candidate) => candidate.id === series.id)
    ? seriesData
    : [...seriesData, { id: series.id, label: series.label, color: series.lineColor, points: [] }];

  return nextSeriesData.map((candidate) => {
    if (candidate.id !== series.id) {
      return candidate;
    }

    const mergedPoints = mergePoints(candidate.points, points);
    if (mergedPoints === candidate.points) {
      return candidate;
    }

    return {
      ...candidate,
      label: series.label,
      color: series.lineColor,
      points: mergedPoints,
    };
  });
}

/**
 * @param {{value?: string, updatedAt?: number, points?: unknown[]} | undefined} snapshot
 * @returns {ChartPoint[]}
 */
export function normalizeSnapshotPoints(snapshot) {
  if (Array.isArray(snapshot?.points) && snapshot.points.length) {
    return snapshot.points.map(normalizePoint).filter(Boolean);
  }

  const value = parseNumericValue(snapshot?.value);
  if (!Number.isFinite(value)) {
    return [];
  }

  return [
    {
      t: snapshot.updatedAt || Date.now(),
      y: value,
    },
  ];
}

function normalizePoint(point) {
  const t = Number(point?.t);
  const y = Number(point?.y);
  const sourceT = Number(point?.sourceT);
  if (!Number.isFinite(t) || !Number.isFinite(y)) {
    return null;
  }

  return Number.isFinite(sourceT) ? { t, y, sourceT } : { t, y };
}

function mergePoints(existingPoints, nextPoints) {
  const pointsByKey = new Map();
  for (const point of existingPoints) {
    pointsByKey.set(pointKey(point), point);
  }

  let changed = false;
  for (const point of nextPoints) {
    const key = pointKey(point);
    const existing = pointsByKey.get(key);
    if (existing && pointsEqual(existing, point)) {
      continue;
    }

    pointsByKey.set(key, point);
    changed = true;
  }

  if (!changed) {
    return existingPoints;
  }

  return [...pointsByKey.values()].sort((first, second) => first.t - second.t);
}

function pointKey(point) {
  return Number.isFinite(point.sourceT) ? `source:${point.sourceT}` : `time:${point.t}`;
}

function pointsEqual(first, second) {
  return first.t === second.t && first.y === second.y && first.sourceT === second.sourceT;
}

function parseNumericValue(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

/**
 * @typedef {object} ChartPoint
 * @property {number} t
 * @property {number} y
 * @property {number} [sourceT]
 */

/**
 * @typedef {object} ChartSeriesData
 * @property {string} id
 * @property {string} label
 * @property {string} color
 * @property {ChartPoint[]} points
 */
