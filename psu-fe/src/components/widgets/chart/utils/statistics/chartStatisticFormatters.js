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
 * Formats integer statistics without units.
 *
 * @param {number | null} value
 * @returns {string}
 */
export function formatInteger(value) {
  return Number.isFinite(value) ? String(Math.round(value)) : "--";
}

/**
 * Formats a numeric statistic using the chart's configured unit.
 *
 * @param {number | null} value
 * @param {{unit?: string}} context
 * @returns {string}
 */
export function formatUnitValue(value, context = {}) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const formattedNumber = value.toFixed(4);
  return context.unit ? `${formattedNumber} ${context.unit}` : formattedNumber;
}

/**
 * Formats a per-second slope using the chart's configured unit.
 *
 * @param {number | null} value
 * @param {{unit?: string}} context
 * @returns {string}
 */
export function formatUnitPerSecond(value, context = {}) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  const formattedNumber = value.toFixed(4);
  return context.unit ? `${formattedNumber} ${context.unit}/s` : `${formattedNumber} /s`;
}

/**
 * Formats a frequency in hertz.
 *
 * @param {number | null} value
 * @returns {string}
 */
export function formatHertz(value) {
  return Number.isFinite(value) ? `${value.toFixed(4)} Hz` : "--";
}

/**
 * Formats a period in seconds.
 *
 * @param {number | null} value
 * @returns {string}
 */
export function formatSeconds(value) {
  return Number.isFinite(value) ? `${value.toFixed(4)} s` : "--";
}
