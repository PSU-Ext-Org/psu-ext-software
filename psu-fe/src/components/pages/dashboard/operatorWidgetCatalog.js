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
} from "../../widgets/chart";
import {
  ExternalTriggerControlActions,
  ExternalTriggerControlCard,
  ExternalTriggerControlTitle,
} from "../../widgets/externalTrigger";
import {
  ProtectionControlActions,
  ProtectionControlCard,
  ProtectionControlTitle,
} from "../../widgets/protection";
import {
  SingleToggleCard,
  SingleToggleCardActions,
  SingleToggleCardTitle,
} from "../../widgets/singleToggle";
import {
  SingleValueCard,
  SingleValueCardActions,
  SingleValueCardTitle,
} from "../../widgets/singleValue";
import {
  TimerQueueCard,
  TimerQueueCardActions,
  TimerQueueCardTitle,
} from "../../widgets/timerQueue";
import {
  XyChartCard,
  XyChartCardActions,
  XyChartCardTitle,
} from "../../widgets/xyChart";

/**
 * Builds the shared operator widget choices and renderers for either dashboard.
 * Namespaced placement IDs keep each page's widget settings independent.
 * @param {string} namespace - Placement ID namespace, such as "dashboard" or "other".
 * @returns {{
 *   available: import("../../dashboard/domain/dashboardTypes.js").AvailableWidget[],
 *   definitions: Record<string, import("../../dashboard/domain/dashboardTypes.js").WidgetDefinition>,
 *   editable: boolean
 * }}
 */
export function createOperatorWidgetCatalog(namespace) {
  return {
    available: [
      { type: "singleValue", label: "Single Value", idPrefix: `single-value-${namespace}`, w: 1, h: 1 },
      { type: "singleToggle", label: "Single Toggle", idPrefix: `single-toggle-${namespace}`, w: 1, h: 1 },
      { type: "protectionControl", label: "Protection Control", idPrefix: `protection-${namespace}`, w: 1, h: 1 },
      { type: "externalTriggerControl", label: "External Triggers 1x2", idPrefix: `trigger-${namespace}`, w: 1, h: 2 },
      { type: "timerQueueControl", label: "Timer Queue 2x2", idPrefix: `timer-${namespace}`, w: 2, h: 2 },
      { type: "chart", label: "Chart 2x1", idPrefix: `chart-${namespace}-small`, w: 2, h: 1 },
      { type: "chart", label: "Chart 2x2", idPrefix: `chart-${namespace}-medium`, w: 2, h: 2 },
      { type: "chart", label: "Chart 3x2", idPrefix: `chart-${namespace}-large`, w: 3, h: 2 },
      { type: "xyChart", label: "XY Chart 2x2", idPrefix: `xy-chart-${namespace}-medium`, w: 2, h: 2 },
      { type: "xyChart", label: "XY Chart 3x2", idPrefix: `xy-chart-${namespace}-large`, w: 3, h: 2 },
    ],
    definitions: {
      chart: {
        actions: ChartCardActions,
        render: ChartCard,
        text: "Live SCPI trend.",
        title: ChartCardTitle,
      },
      xyChart: {
        actions: XyChartCardActions,
        render: XyChartCard,
        text: "SCPI X-Y plot.",
        title: XyChartCardTitle,
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
  };
}
