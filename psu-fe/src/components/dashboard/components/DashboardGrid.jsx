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
import { useCallback, useRef } from "react";
import { isPlacementAvailable } from "../domain/dashboardPlacement.js";
import { DashboardWidget } from "./DashboardWidget.jsx";
import { useDashboardWidgetDrag } from "../hooks/useDashboardWidgetDrag.js";

/**
 * Renders a positioned dashboard grid and coordinates widget drag interactions.
 *
 * @param {object} props
 * @param {object} props.dashboard - Grid layout and editing behavior.
 * @returns {import("react").ReactElement}
 */
export function DashboardGrid({ dashboard }) {
  const { editing, layout } = dashboard;
  const { columns, placements, rowHeight, templateRows, widgets } = layout;
  const gridRef = useRef(null);
  const { dragState, startDrag } = useDashboardWidgetDrag({
    columns,
    gridRef,
    onDrop: editing.moveWidget,
    rowHeight,
  });
  const draggedPlacement = dragState
    ? placements.find((placement) => placement.id === dragState.id)
    : null;
  const dropCandidate = draggedPlacement ? { ...draggedPlacement, ...dragState.previewPosition } : null;
  const dropAllowed = dropCandidate ? isPlacementAvailable(dropCandidate, placements, columns) : false;
  const gridStyle = templateRows
    ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: templateRows }
    : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: `${rowHeight}px` };

  const handleWidgetDragStart = useCallback(
    (event, placement) => startDrag({ editMode: editing.enabled, event, placement }),
    [editing.enabled, startDrag],
  );
  const handleWidgetRemove = useCallback(
    (placement) => editing.removeWidget(placement),
    [editing.removeWidget],
  );

  return (
    <div
      aria-label="Dashboard widget grid"
      className="dashboard-grid grid gap-4"
      data-dragging={dragState ? "true" : undefined}
      ref={gridRef}
      style={gridStyle}
    >
      {dragState ? (
        <DashboardDropPlaceholder
          allowed={dropAllowed}
          placement={draggedPlacement}
          previewPosition={dragState.previewPosition}
        />
      ) : null}
      {placements.map((placement) => (
        <DashboardWidget
          dragging={dragState?.id === placement.id}
          editMode={editing.enabled}
          key={placement.id}
          onDragStart={handleWidgetDragStart}
          onRemove={handleWidgetRemove}
          placement={placement}
          widget={widgets[placement.type]}
        />
      ))}
    </div>
  );
}

/**
 * Shows whether the current drag target is a valid grid position.
 *
 * @param {object} props
 * @param {boolean} props.allowed
 * @param {import("../domain/dashboardTypes.js").WidgetPlacement | null} props.placement
 * @param {{x: number, y: number}} props.previewPosition
 * @returns {import("react").ReactElement}
 */
function DashboardDropPlaceholder({ allowed, placement, previewPosition }) {
  const className = [
    "pointer-events-none rounded-lg border-2 border-dashed",
    allowed ? "border-teal-400 bg-teal-100/50" : "border-rose-400 bg-rose-100/50",
  ].join(" ");

  return (
    <div
      aria-hidden="true"
      className={className}
      data-testid="dashboard-drop-placeholder"
      style={{
        gridColumn: `${previewPosition.x + 1} / span ${placement?.w || 1}`,
        gridRow: `${previewPosition.y + 1} / span ${placement?.h || 1}`,
      }}
    />
  );
}
