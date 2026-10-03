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
 * Converts collected X-Y points to uPlot's faceted (`mode: 2`) data layout: no shared X column, one
 * `[xValues, yValues]` pair per series, in acquisition order. With `showProduct` a second series plots
 * `x * y` against the same X values.
 *
 * @param {Array<{x: number, y: number}>} points
 * @param {boolean} [showProduct]
 * @returns {{totalPoints: number, data: Array<null | [number[], number[]]>}}
 */
export function toXyUplotData(points, showProduct = false) {
  const xValues = points.map((point) => point.x);
  const data = [null, [xValues, points.map((point) => point.y)]];
  if (showProduct) {
    data.push([xValues, points.map((point) => point.x * point.y)]);
  }

  return { totalPoints: points.length, data };
}

/**
 * @param {{label?: string, unit?: string}} axis
 * @returns {string} Axis title such as `Voltage (V)`.
 */
export function formatAxisLabel(axis) {
  const label = String(axis?.label || "").trim();
  const unit = String(axis?.unit || "").trim();
  return unit ? `${label} (${unit})` : label;
}

/**
 * @param {number | null | undefined} value
 * @returns {string}
 */
export function formatAxisNumber(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return String(Number.parseFloat(value.toPrecision(6)));
}

/**
 * Pads an auto-scaled range so points do not sit on the plot edge.
 *
 * @param {number} min
 * @param {number} max
 * @returns {[number, number]}
 */
export function paddedValueRange(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0, 1];
  }

  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.1, 1);
    return [min - padding, max + padding];
  }

  const padding = Math.max((max - min) * 0.08, Math.max(Math.abs(min), Math.abs(max)) * 0.01, 0.0001);
  return [min - padding, max + padding];
}
