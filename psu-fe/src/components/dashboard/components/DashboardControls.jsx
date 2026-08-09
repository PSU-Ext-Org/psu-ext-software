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
import { Plus, RotateCcw } from "lucide-react";
import { getAvailableWidgetOptionValue } from "../domain/dashboardWidgetCatalog.js";

/**
 * Renders dashboard identity, edit controls, and the add-widget selector.
 *
 * @param {object} props
 * @param {object} props.toolbar - Named toolbar groups for one dashboard.
 * @returns {import("react").ReactElement}
 */
export function DashboardControls({ toolbar }) {
  const { editing, identity, widgetPicker } = toolbar;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <DashboardLayoutId identity={identity} />
      <DashboardWidgetPicker editing={editing} picker={widgetPicker} />
      <DashboardEditActions editing={editing} />
    </div>
  );
}

/** Renders the persisted layout identifier. */
function DashboardLayoutId({ identity }) {
  return (
    <div
      aria-label={`Layout ID: ${identity.layoutId}`}
      className="hidden rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm sm:block"
      data-testid="dashboard-layout-id"
    >
      {identity.layoutId}
    </div>
  );
}

/** Renders the widget selection control while layout editing is active. */
function DashboardWidgetPicker({ editing, picker }) {
  const isVisible = editing.allowed && editing.enabled && picker.options.length > 0;

  function handleSelectedWidgetTypeChange(event) {
    picker.selectWidgetType(event.target.value);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div
      aria-label="Add widget"
      className="flex h-8 items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
      role="group"
    >
      <label className="sr-only" htmlFor={`${picker.pageId}-add-widget-type`}>
        Widget type
      </label>
      <select
        className="h-full min-w-36 border-0 bg-white px-3 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50"
        id={`${picker.pageId}-add-widget-type`}
        onChange={handleSelectedWidgetTypeChange}
        value={picker.selectedWidgetType}
      >
        {picker.options.map((availableWidget) => (
          <option
            key={getAvailableWidgetOptionValue(availableWidget)}
            value={getAvailableWidgetOptionValue(availableWidget)}
          >
            {availableWidget.label}
          </option>
        ))}
      </select>
      <button
        aria-label="Add selected widget"
        className="inline-flex h-full w-8 items-center justify-center border-l border-slate-200 text-slate-700 hover:bg-slate-50"
        onClick={picker.addWidget}
        type="button"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Renders edit, reset, and done actions for a dashboard layout. */
function DashboardEditActions({ editing }) {
  const shouldShowReset = editing.allowed && editing.enabled;
  const editButtonClassName = [
    "control-standard inline-flex items-center justify-center gap-2 font-medium shadow-sm",
    editing.enabled
      ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
      : "bg-teal-700 text-white hover:bg-teal-800",
  ].join(" ");

  return (
    <>
      {shouldShowReset ? (
        <button
          className="control-standard inline-flex items-center justify-center gap-2 border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
          onClick={editing.resetLayout}
          type="button"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      ) : null}
      {editing.allowed ? (
        <button
          aria-pressed={editing.enabled}
          className={editButtonClassName}
          onClick={editing.toggleEditMode}
          type="button"
        >
          {editing.enabled ? "Done" : "Edit"}
        </button>
      ) : null}
    </>
  );
}
