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
import { Trash2 } from "lucide-react";
import { memo } from "react";

/**
 * Renders one dashboard widget card at its assigned grid placement.
 *
 * @param {object} props
 * @param {boolean} props.dragging
 * @param {boolean} props.editMode
 * @param {(event: import("react").PointerEvent, placement: import("../domain/dashboardTypes.js").WidgetPlacement) => void} props.onDragStart
 * @param {(placement: import("../domain/dashboardTypes.js").WidgetPlacement) => void} props.onRemove
 * @param {import("../domain/dashboardTypes.js").WidgetPlacement} props.placement
 * @param {import("../domain/dashboardTypes.js").WidgetDefinition} props.widget
 * @returns {import("react").ReactElement}
 */
export const DashboardWidget = memo(function DashboardWidget({
  dragging,
  editMode,
  onDragStart,
  onRemove,
  placement,
  widget,
}) {
  const WidgetIcon = widget?.icon;
  const WidgetContent = widget?.render;
  const WidgetStatus = widget?.status;
  const WidgetActions = widget?.actions;
  const WidgetTitle = widget?.title;
  const title = getWidgetTitle(WidgetTitle, placement);
  const accessibleName = typeof WidgetTitle === "string" ? WidgetTitle : placement.id;
  const className = [
    "dashboard-widget flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white p-5 shadow-sm transition",
    editMode ? "border-teal-300 ring-1 ring-teal-100" : "border-slate-200",
    editMode ? "touch-none select-none cursor-grab active:cursor-grabbing" : "",
    dragging ? "z-10 opacity-90 shadow-md ring-2 ring-teal-300" : "",
  ].join(" ");

  function handlePointerDown(event) {
    onDragStart(event, placement);
  }

  function handleRemove() {
    onRemove(placement);
  }

  function preventDrag(event) {
    event.stopPropagation();
  }

  return (
    <article
      aria-label={accessibleName}
      className={className}
      data-widget-id={placement.id}
      onPointerDown={editMode ? handlePointerDown : undefined}
      style={{
        gridColumn: `${placement.x + 1} / span ${placement.w}`,
        gridRow: `${placement.y + 1} / span ${placement.h}`,
        "--dashboard-widget-height": placement.h,
      }}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="min-w-0 truncate text-lg font-semibold">{title || placement.id}</h2>
          {widget?.text ? <p className="min-w-0 text-sm text-slate-600">{widget.text}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {editMode ? (
            <button
              aria-label={`Delete ${accessibleName}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-700 shadow-sm hover:bg-rose-50"
              onClick={handleRemove}
              onPointerDown={preventDrag}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
          {WidgetActions ? <WidgetActions placement={placement} /> : null}
          {WidgetIcon ? <WidgetIcon className="h-5 w-5 text-teal-700" /> : null}
        </div>
      </div>

      {WidgetContent ? (
        <div className="mt-5 min-h-0 min-w-0 flex-1 overflow-auto">
          <WidgetContent placement={placement} />
        </div>
      ) : null}

      {WidgetStatus ? (
        <div className="mt-5 flex min-w-0 shrink-0 items-center justify-between gap-3 rounded-md bg-slate-100 px-3 py-2 text-sm">
          <span className="shrink-0 text-slate-600">Status</span>
          <strong className="min-w-0 truncate text-right">
            <WidgetStatus placement={placement} />
          </strong>
        </div>
      ) : null}
    </article>
  );
}, areDashboardWidgetPropsEqual);

function getWidgetTitle(WidgetTitle, placement) {
  return typeof WidgetTitle === "function" ? <WidgetTitle placement={placement} /> : WidgetTitle;
}

function areDashboardWidgetPropsEqual(previous, next) {
  return (
    previous.dragging === next.dragging &&
    previous.editMode === next.editMode &&
    previous.onDragStart === next.onDragStart &&
    previous.onRemove === next.onRemove &&
    previous.widget === next.widget &&
    samePlacement(previous.placement, next.placement)
  );
}

function samePlacement(first, second) {
  if (!first || !second) {
    return first === second;
  }

  return (
    first.id === second.id &&
    first.type === second.type &&
    first.x === second.x &&
    first.y === second.y &&
    first.w === second.w &&
    first.h === second.h
  );
}
