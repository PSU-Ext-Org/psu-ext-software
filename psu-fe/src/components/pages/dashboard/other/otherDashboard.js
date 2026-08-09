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
import { ChartCard, ChartCardActions, ChartCardTitle } from "../../../widgets/chart";
import {
  SingleValueCard,
  SingleValueCardActions,
  SingleValueCardTitle,
} from "../../../widgets/singleValue";
import { deleteStoredWidgetConfig } from "../../../widgets/widgetConfigStore.js";

/** Configurable dashboard definition for the secondary operator workspace. */
export const otherDashboard = {
  identity: {
    pageId: "other-dashboard",
    storageKey: "psu-ext.dashboard.other-layout.v1",
  },
  layout: {
    defaultLayout: [],
  },
  widgets: {
    available: [
      { type: "singleValue", label: "Single Value", idPrefix: "single-value-other", w: 1, h: 1 },
      { type: "chart", label: "Chart 2x1", idPrefix: "chart-other-small", w: 2, h: 1 },
      { type: "chart", label: "Chart 2x2", idPrefix: "chart-other-medium", w: 2, h: 2 },
      { type: "chart", label: "Chart 3x2", idPrefix: "chart-other-large", w: 3, h: 2 },
    ],
    definitions: {
      chart: {
        actions: ChartCardActions,
        render: ChartCard,
        text: "Live SCPI trend.",
        title: ChartCardTitle,
      },
      singleValue: {
        actions: SingleValueCardActions,
        render: SingleValueCard,
        text: "Cached SCPI query value.",
        title: SingleValueCardTitle,
      },
    },
    editable: true,
  },
};

/**
 * Removes persisted data that belongs only to a deleted secondary-dashboard widget.
 *
 * @param {{id: string}} placement - Removed widget placement.
 * @returns {void}
 */
export function removeOtherWidgetData(placement) {
  deleteStoredWidgetConfig(placement.id);
}
