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
  ChartCard,
  ChartCardActions,
  ChartCardTitle,
  deleteChartHistory,
} from "../../../widgets/chart";
import {
  ExternalTriggerControlActions,
  ExternalTriggerControlCard,
  ExternalTriggerControlTitle,
} from "../../../widgets/externalTrigger";
import {
  ProtectionControlActions,
  ProtectionControlCard,
  ProtectionControlTitle,
} from "../../../widgets/protection";
import {
  SingleToggleCard,
  SingleToggleCardActions,
  SingleToggleCardTitle,
} from "../../../widgets/singleToggle";
import {
  SingleValueCard,
  SingleValueCardActions,
  SingleValueCardTitle,
} from "../../../widgets/singleValue";
import {
  TimerQueueCard,
  TimerQueueCardActions,
  TimerQueueCardTitle,
} from "../../../widgets/timerQueue";
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
  widgets: {
    available: [
      { type: "singleValue", label: "Single Value", idPrefix: "single-value-dashboard", w: 1, h: 1 },
      { type: "singleToggle", label: "Single Toggle", idPrefix: "single-toggle-dashboard", w: 1, h: 1 },
      { type: "protectionControl", label: "Protection Control", idPrefix: "protection-dashboard", w: 1, h: 1 },
      { type: "externalTriggerControl", label: "External Triggers 1x2", idPrefix: "trigger-dashboard", w: 1, h: 2 },
      { type: "timerQueueControl", label: "Timer Queue 2x2", idPrefix: "timer-dashboard", w: 2, h: 2 },
      { type: "chart", label: "Chart 2x1", idPrefix: "chart-dashboard-small", w: 2, h: 1 },
      { type: "chart", label: "Chart 2x2", idPrefix: "chart-dashboard-medium", w: 2, h: 2 },
      { type: "chart", label: "Chart 3x2", idPrefix: "chart-dashboard-large", w: 3, h: 2 },
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
        text: "SCPI query value.",
        title: SingleValueCardTitle,
      },
      singleToggle: {
        actions: SingleToggleCardActions,
        render: SingleToggleCard,
        text: "SCPI Bin control.",
        title: SingleToggleCardTitle,
      },
      protectionControl: {
        actions: ProtectionControlActions,
        render: ProtectionControlCard,
        text: "Protection controls",
        title: ProtectionControlTitle,
      },
      externalTriggerControl: {
        actions: ExternalTriggerControlActions,
        render: ExternalTriggerControlCard,
        text: "Trigger controls",
        title: ExternalTriggerControlTitle,
      },
      timerQueueControl: {
        actions: TimerQueueCardActions,
        render: TimerQueueCard,
        text: "Queued timer control",
        title: TimerQueueCardTitle,
      },
    },
    editable: true,
  },
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
}
