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
import { useEffect, useMemo, useState } from "react";
import {
  getAvailableWidgetOptionValue,
  getSelectedAvailableWidget,
} from "../domain/dashboardWidgetCatalog.js";

/**
 * Owns the selected widget type for the dashboard add-widget control.
 *
 * @param {object} options
 * @param {Array<import("../domain/dashboardTypes.js").AvailableWidget>} options.availableWidgets
 * @param {boolean} options.editable
 * @param {Record<string, import("../domain/dashboardTypes.js").WidgetDefinition>} options.widgets
 * @returns {object} Available widget variants and the current selection.
 */
export function useDashboardWidgetPicker({ availableWidgets, editable, widgets }) {
  const [selectedWidgetType, setSelectedWidgetType] = useState("");
  const addableWidgets = useMemo(
    () => (editable ? availableWidgets.filter((widget) => widgets[widget.type]) : []),
    [availableWidgets, editable, widgets],
  );
  const selectedWidget = useMemo(
    () => getSelectedAvailableWidget(addableWidgets, selectedWidgetType),
    [addableWidgets, selectedWidgetType],
  );
  const selectedWidgetValue = selectedWidget ? getAvailableWidgetOptionValue(selectedWidget) : "";

  useEffect(() => {
    if (selectedWidgetValue !== selectedWidgetType) {
      setSelectedWidgetType(selectedWidgetValue);
    }
  }, [selectedWidgetType, selectedWidgetValue]);

  return {
    addableWidgets,
    selectedWidget,
    selectedWidgetType: selectedWidgetValue,
    setSelectedWidgetType,
  };
}
