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
import { useCallback, useEffect, useState } from "react";
import {
  createDefaultLayoutRecord,
  loadLayoutRecord,
  saveLayoutRecord,
} from "../domain/dashboardLayoutStorage.js";
import { findAvailablePlacement, isPlacementAvailable } from "../domain/dashboardPlacement.js";
import { createWidget } from "../domain/dashboardWidgetCatalog.js";
import { useDashboardWidgetPicker } from "./useDashboardWidgetPicker.js";

/**
 * Owns a dashboard's persisted layout and edit-mode actions.
 *
 * @param {object} options
 * @param {object} options.dashboard - Complete dashboard configuration grouped by concern.
 * @param {{pageId: string, storageKey: string}} options.dashboard.identity
 * @param {{defaultLayout: Array<import("../domain/dashboardTypes.js").WidgetPlacement>, columns: number, rowHeight: number, gridTemplateRows?: string}} options.dashboard.layout
 * @param {{definitions: Record<string, import("../domain/dashboardTypes.js").WidgetDefinition>, available: Array<import("../domain/dashboardTypes.js").AvailableWidget>, editable: boolean}} options.dashboard.widgets
 * @param {(placement: import("../domain/dashboardTypes.js").WidgetPlacement) => void} [options.onWidgetRemoved]
 * @returns {object} Layout state and actions for a dashboard page.
 */
export function useDashboardLayout({ dashboard, onWidgetRemoved }) {
  const { identity, layout, widgets: widgetCatalog } = dashboard;
  const { pageId, storageKey } = identity;
  const { columns, defaultLayout, gridTemplateRows, rowHeight } = layout;
  const { available: availableWidgets, definitions: widgets, editable } = widgetCatalog;
  const [editMode, setEditMode] = useState(false);
  const [layoutRecord, setLayoutRecord] = useState(() =>
    loadLayoutRecord({ storageKey, defaultLayout, widgets, columns, dynamic: editable }),
  );
  const widgetPicker = useDashboardWidgetPicker({ availableWidgets, editable, widgets });

  useEffect(() => {
    saveLayoutRecord(storageKey, layoutRecord);
  }, [layoutRecord, storageKey]);

  const addWidget = useCallback(() => {
    if (!widgetPicker.selectedWidget) {
      return;
    }

    const widget = createWidget(widgetPicker.selectedWidget, pageId, columns);
    setLayoutRecord((current) => ({
      ...current,
      widgets: [...current.widgets, findAvailablePlacement(widget, current.widgets, columns)],
    }));
  }, [columns, pageId, widgetPicker.selectedWidget]);

  const moveWidget = useCallback((id, previewPosition) => {
    setLayoutRecord((current) => moveWidgetInLayout(current, id, previewPosition, columns));
  }, [columns]);

  const removeWidget = useCallback((placement) => {
    setLayoutRecord((current) => ({
      ...current,
      widgets: current.widgets.filter((widget) => widget.id !== placement.id),
    }));
    onWidgetRemoved?.(placement);
  }, [onWidgetRemoved]);

  const resetLayout = useCallback(() => {
    setLayoutRecord(createDefaultLayoutRecord({ defaultLayout, widgets, columns, dynamic: editable }));
  }, [columns, defaultLayout, editable, widgets]);

  const toggleEditMode = useCallback(() => {
    setEditMode((current) => !current);
  }, []);

  return {
    grid: {
      editing: {
        enabled: editMode,
        moveWidget,
        removeWidget,
      },
      layout: {
        columns,
        placements: layoutRecord.widgets,
        rowHeight,
        templateRows: gridTemplateRows,
        widgets,
      },
    },
    toolbar: {
      editing: {
        allowed: editable,
        enabled: editMode,
        resetLayout,
        toggleEditMode,
      },
      identity: {
        layoutId: layoutRecord.layoutId,
      },
      widgetPicker: {
        addWidget,
        options: widgetPicker.addableWidgets,
        pageId,
        selectWidgetType: widgetPicker.setSelectedWidgetType,
        selectedWidgetType: widgetPicker.selectedWidgetType,
      },
    },
  };
}

/**
 * Applies a valid widget drop without changing unrelated widget objects.
 *
 * @param {object} layoutRecord
 * @param {string} id
 * @param {{x: number, y: number}} previewPosition
 * @param {number} columns
 * @returns {object}
 */
function moveWidgetInLayout(layoutRecord, id, previewPosition, columns) {
  const currentWidget = layoutRecord.widgets.find((widget) => widget.id === id);
  if (!currentWidget) {
    return layoutRecord;
  }

  const nextWidget = { ...currentWidget, ...previewPosition };
  if (!isPlacementAvailable(nextWidget, layoutRecord.widgets, columns)) {
    return layoutRecord;
  }

  return {
    ...layoutRecord,
    widgets: layoutRecord.widgets.map((widget) => (widget.id === id ? nextWidget : widget)),
  };
}
