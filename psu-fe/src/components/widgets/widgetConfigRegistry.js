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
import {
  chartWidgetConfigSource,
} from "./chart/chartConfig.js";
import {
  singleToggleWidgetConfigSource,
} from "./singleToggle/singleToggleConfig.js";
import {
  singleValueWidgetConfigSource,
} from "./singleValue/singleValueConfig.js";

const widgetConfigSources = new Map();

registerWidgetConfigSource("singleValue", singleValueWidgetConfigSource);
registerWidgetConfigSource("chart", chartWidgetConfigSource);
registerWidgetConfigSource("singleToggle", singleToggleWidgetConfigSource);

/**
 * @param {string} widgetType
 * @param {{loadRunnableSubscriptions?: () => Array<{widgetId: string, deviceName: string, query: string, frequencyHz: number}>}} source
 */
export function registerWidgetConfigSource(widgetType, source) {
  widgetConfigSources.set(widgetType, source);
}

/**
 * @returns {Array<{widgetId: string, deviceName: string, query: string, frequencyHz: number}>}
 */
export function getAllRunnableWidgetSubscriptions() {
  return [...widgetConfigSources.values()].flatMap(
    (source) => source.loadRunnableSubscriptions?.() || [],
  );
}
