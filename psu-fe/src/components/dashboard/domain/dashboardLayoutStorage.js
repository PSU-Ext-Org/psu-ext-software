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
import { createLayoutId } from "./dashboardIds.js";
import { normalizeDynamicLayout, normalizeStaticLayout } from "./dashboardPlacement.js";

/**
 * Loads and normalizes a persisted dashboard layout.
 *
 * @param {object} options
 * @returns {{layoutId: string, layoutHash: string, widgets: Array<object>}}
 */
export function loadLayoutRecord({ storageKey, defaultLayout, widgets, columns, dynamic }) {
  const defaultRecord = createDefaultLayoutRecord({ defaultLayout, widgets, columns, dynamic });

  try {
    const storedValue = window.localStorage.getItem(storageKey);
    if (!storedValue) {
      return defaultRecord;
    }

    const parsed = JSON.parse(storedValue);
    if (!dynamic && parsed.layoutHash !== defaultRecord.layoutHash) {
      return defaultRecord;
    }

    return {
      layoutId: typeof parsed.layoutId === "string" ? parsed.layoutId : defaultRecord.layoutId,
      layoutHash: defaultRecord.layoutHash,
      widgets: dynamic
        ? normalizeDynamicLayout(parsed.widgets, widgets, columns)
        : normalizeStaticLayout(parsed.widgets, defaultLayout, columns),
    };
  } catch {
    return defaultRecord;
  }
}

/**
 * Persists a dashboard layout record.
 *
 * @param {string} storageKey
 * @param {object} layoutRecord
 * @returns {void}
 */
export function saveLayoutRecord(storageKey, layoutRecord) {
  window.localStorage.setItem(storageKey, JSON.stringify(layoutRecord));
}

/**
 * Creates a normalized layout record from code-defined defaults.
 *
 * @param {object} options
 * @returns {{layoutId: string, layoutHash: string, widgets: Array<object>}}
 */
export function createDefaultLayoutRecord({ defaultLayout, widgets, columns, dynamic }) {
  return {
    layoutId: createLayoutId(),
    layoutHash: dynamic ? "" : createStaticLayoutHash(defaultLayout, columns),
    widgets: dynamic
      ? normalizeDynamicLayout(defaultLayout, widgets, columns)
      : normalizeStaticLayout(defaultLayout, defaultLayout, columns),
  };
}

function createStaticLayoutHash(defaultLayout, columns) {
  return JSON.stringify({
    columns,
    widgets: defaultLayout.map(({ id, type, mode, x, y, w, h }) => ({ id, type, mode, x, y, w, h })),
  });
}
