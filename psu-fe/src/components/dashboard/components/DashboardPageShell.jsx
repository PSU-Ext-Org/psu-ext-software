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
import { PageHeading } from "../../layout/app/PageHeading.jsx";
import { DashboardControls } from "./DashboardControls.jsx";
import { DashboardGrid } from "./DashboardGrid.jsx";
import { useDashboardLayout } from "../hooks/useDashboardLayout.js";

const DEFAULT_COLUMNS = 3;
const DEFAULT_ROW_HEIGHT = 256;

/**
 * Shared parent for dashboard-style pages with persisted layout and edit mode.
 *
 * @param {object} props
 * @param {object} props.dashboard - Complete dashboard configuration.
 * @param {{pageId: string, storageKey: string}} props.dashboard.identity - Stable page and persistence identifiers.
 * @param {{defaultLayout: Array<WidgetPlacement>, columns?: number, rowHeight?: number, gridTemplateRows?: string}} props.dashboard.layout - Initial positions and grid geometry.
 * @param {{definitions: Record<string, WidgetDefinition>, available?: Array<AvailableWidget>, editable?: boolean}} props.dashboard.widgets - Widget registry and edit policy.
 * @param {(placement: WidgetPlacement) => void} [props.onWidgetRemoved] - Called after widget removal.
 * @param {number} [props.columns] - Number of horizontal grid slots.
 * @param {number} [props.rowHeight] - Pixel height for one grid row.
 * @param {string} [props.gridTemplateRows] - Explicit CSS grid-template-rows value.
 * @returns {import("react").ReactElement}
 */
export function DashboardPageShell({
  dashboard,
  onWidgetRemoved,
}) {
  const dashboardState = useDashboardLayout({
    dashboard: {
      identity: dashboard.identity,
      layout: {
        columns: DEFAULT_COLUMNS,
        rowHeight: DEFAULT_ROW_HEIGHT,
        ...dashboard.layout,
      },
      widgets: {
        available: [],
        editable: true,
        ...dashboard.widgets,
      },
    },
    onWidgetRemoved,
  });
  const headingActions = <DashboardControls toolbar={dashboardState.toolbar} />;

  return (
    <main data-dashboard-page={dashboard.identity.pageId}>
      <PageHeading actions={headingActions} />

      <section className="mx-auto max-w-6xl px-6 pb-6">
        <DashboardGrid dashboard={dashboardState.grid} />
      </section>
    </main>
  );
}

/** @typedef {import("../domain/dashboardTypes.js").WidgetPlacement} WidgetPlacement */
/** @typedef {import("../domain/dashboardTypes.js").WidgetDefinition} WidgetDefinition */
/** @typedef {import("../domain/dashboardTypes.js").AvailableWidget} AvailableWidget */
