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
import { createWidgetId } from "./dashboardIds.js";

/**
 * Returns the available widget represented by a select-option value.
 *
 * @param {Array<import("./dashboardTypes.js").AvailableWidget>} availableWidgets
 * @param {string} selectedWidgetType
 * @returns {import("./dashboardTypes.js").AvailableWidget | null}
 */
export function getSelectedAvailableWidget(availableWidgets, selectedWidgetType) {
  return (
    availableWidgets.find((widget) => getAvailableWidgetOptionValue(widget) === selectedWidgetType) ||
    availableWidgets[0] ||
    null
  );
}

/**
 * Creates a bounded initial placement for a newly added widget.
 *
 * @param {import("./dashboardTypes.js").AvailableWidget} availableWidget
 * @param {string} pageId
 * @param {number} columns
 * @returns {import("./dashboardTypes.js").WidgetPlacement}
 */
export function createWidget(availableWidget, pageId, columns) {
  return {
    id: createWidgetId({ pageId, type: availableWidget.type, idPrefix: availableWidget.idPrefix }),
    type: availableWidget.type,
    x: 0,
    y: 0,
    w: clamp(toInteger(availableWidget.w, 1), 1, columns),
    h: clamp(toInteger(availableWidget.h, 1), 1, 3),
  };
}

/**
 * Returns a stable value that distinguishes available widget variants.
 *
 * @param {import("./dashboardTypes.js").AvailableWidget} availableWidget
 * @returns {string}
 */
export function getAvailableWidgetOptionValue(availableWidget) {
  return [
    availableWidget.type,
    availableWidget.idPrefix || "",
    availableWidget.label || "",
    availableWidget.w || "",
    availableWidget.h || "",
  ].join(":");
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
