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
 * Formats a Unix millisecond timestamp for compact chart display.
 *
 * @param {number} timestamp
 * @returns {string}
 */
export function formatChartTime(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    return "--";
  }

  return [
    pad(date.getHours(), 2),
    pad(date.getMinutes(), 2),
    pad(date.getSeconds(), 2),
  ].join(":") + `.${pad(date.getMilliseconds(), 3)}`;
}

function pad(value, size) {
  return String(value).padStart(size, "0");
}
