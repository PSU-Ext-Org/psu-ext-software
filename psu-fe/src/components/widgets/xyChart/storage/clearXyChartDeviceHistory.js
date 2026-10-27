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
import { XY_CHART_HISTORY_STORAGE_KEY } from "./xyChartHistoryStorage.js";

/** Public lifecycle adapter: drops persisted X-Y histories when either axis uses the device. */
export function clearXyChartDeviceHistory(deviceName) {
  try {
    const records = JSON.parse(window.localStorage.getItem(XY_CHART_HISTORY_STORAGE_KEY) || "{}");
    let changed = false;
    for (const [id, record] of Object.entries(records)) {
      if (record?.x?.deviceName === deviceName || record?.y?.deviceName === deviceName) {
        delete records[id];
        changed = true;
      }
    }
    if (changed) {
      window.localStorage.setItem(XY_CHART_HISTORY_STORAGE_KEY, JSON.stringify(records));
    }
  } catch {
    // Storage access and malformed saved data must not interrupt connection cleanup.
  }
}
