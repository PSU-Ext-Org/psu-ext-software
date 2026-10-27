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
import { createOperatorWidgetCatalog } from "../operatorWidgetCatalog.js";
import { deleteChartHistory } from "../../../widgets/chart";
import { deleteXyChartHistory } from "../../../widgets/xyChart";
import { deleteStoredWidgetConfig } from "../../../widgets/widgetConfigStore.js";

/** Configurable dashboard definition for the primary operator workspace. */
export const operatorDashboard = {
  identity: {
    pageId: "operator-dashboard",
    storageKey: "psu-ext.dashboard.operator-layout.v2",
  },
  layout: {
    defaultLayout: [],
  },
  widgets: createOperatorWidgetCatalog("dashboard"),
};

/**
 * Removes persisted data that belongs only to a deleted operator-dashboard widget.
 *
 * @param {{id: string, type: string}} placement - Removed widget placement.
 * @returns {void}
 */
export function removeOperatorWidgetData(placement) {
  deleteStoredWidgetConfig(placement.id);

  if (placement.type === "chart") {
    deleteChartHistory(placement.id);
  }

  if (placement.type === "xyChart") {
    deleteXyChartHistory(placement.id);
  }
}
