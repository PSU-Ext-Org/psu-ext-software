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
import { CHART_HISTORY_STORAGE_KEY } from "./chartHistoryStorage.js";

/** Public lifecycle adapter: clears only the named device's persisted time-series samples. */
export function clearChartDeviceHistory(deviceName) {
  try {
    const records = JSON.parse(window.localStorage.getItem(CHART_HISTORY_STORAGE_KEY) || "{}");
    let changed = false;
    for (const record of Object.values(records)) {
      if (!Array.isArray(record?.series)) {
        continue;
      }
      for (const series of record.series) {
        if (series.deviceName === deviceName && series.points?.length) {
          series.points = [];
          changed = true;
        }
      }
    }
    if (changed) {
      window.localStorage.setItem(CHART_HISTORY_STORAGE_KEY, JSON.stringify(records));
    }
  } catch {
    // Storage access and malformed saved data must not interrupt connection cleanup.
  }
}
