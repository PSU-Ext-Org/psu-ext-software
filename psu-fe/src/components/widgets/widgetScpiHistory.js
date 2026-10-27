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
import { CHART_HISTORY_STORAGE_KEY } from "./chart/storage/chartHistoryStorage.js";
import { XY_CHART_HISTORY_STORAGE_KEY } from "./xyChart/storage/xyChartHistoryStorage.js";

/**
 * Removes saved SCPI readings for a disconnected device, including widgets that are not mounted.
 * Other devices' time series and all widget configuration are preserved.
 * @param {string} deviceName
 */
export function clearDeviceScpiHistory(deviceName) {
  for (const key of [CHART_HISTORY_STORAGE_KEY, XY_CHART_HISTORY_STORAGE_KEY]) {
    try {
      const records = JSON.parse(window.localStorage.getItem(key) || "{}");
      let changed = false;
      for (const [id, record] of Object.entries(records)) {
        if (key === XY_CHART_HISTORY_STORAGE_KEY) {
          if (record?.x?.deviceName === deviceName || record?.y?.deviceName === deviceName) {
            delete records[id];
            changed = true;
          }
        } else if (Array.isArray(record?.series)) {
          for (const series of record.series) {
            if (series.deviceName === deviceName && series.points?.length) {
              series.points = [];
              changed = true;
            }
          }
        }
      }
      if (changed) window.localStorage.setItem(key, JSON.stringify(records));
    } catch {
      // Missing or unavailable local storage must not prevent connection cleanup.
    }
  }
}
