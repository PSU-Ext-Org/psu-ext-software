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
import { useCallback, useEffect, useRef, useState } from "react";

const GRID_GAP = 16;
const AUTO_SCROLL_EDGE_PX = 72;
const AUTO_SCROLL_MAX_PX_PER_FRAME = 10;
const INTERACTIVE_TARGET_SELECTOR = "button, input, select, textarea, a, label";

/**
 * Controls dashboard pointer dragging without moving the grid item itself until drop.
 *
 * @param {object} options
 * @param {number} options.columns - Number of dashboard columns.
 * @param {import("react").RefObject<HTMLElement>} options.gridRef - Dashboard grid element.
 * @param {(id: string, position: {x: number, y: number}) => void} options.onDrop - Commits a valid drop candidate.
 * @param {number} options.rowHeight - Pixel height for one grid row.
 * @returns {{dragState: null | DashboardDragState, startDrag: (args: StartDragArgs) => void}}
 */
export function useDashboardWidgetDrag({ columns, gridRef, onDrop, rowHeight }) {
  const [dragState, setDragState] = useState(null);
  const sessionRef = useRef(null);
  const animationFrameRef = useRef(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const startDrag = useCallback(({ editMode, event, placement }) => {
    if (!editMode || event.button !== 0) {
      return;
    }

    if (event.target?.closest?.(INTERACTIVE_TARGET_SELECTOR)) {
      return;
    }

    const element = event.currentTarget;
    const elementRect = element.getBoundingClientRect();
    const session = {
      element,
      id: placement.id,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      offsetX: event.clientX - elementRect.left,
      offsetY: event.clientY - elementRect.top,
      pointerId: event.pointerId,
      previewPosition: { x: placement.x, y: placement.y },
      startPageX: event.clientX + window.scrollX,
      startPageY: event.clientY + window.scrollY,
      startPlacement: placement,
    };

    event.preventDefault();
    element.setPointerCapture?.(event.pointerId);
    element.style.willChange = "transform";
    document.body.classList.add("dashboard-widget-dragging");
    sessionRef.current = session;
    setDragState({ id: placement.id, previewPosition: session.previewPosition });
  }, []);

  useEffect(() => {
    if (!dragState?.id) {
      return undefined;
    }

    function updateDragPosition() {
      const session = sessionRef.current;
      const gridElement = gridRef.current;
      if (!session || !gridElement) {
        return;
      }

      const pageX = session.lastClientX + window.scrollX;
      const pageY = session.lastClientY + window.scrollY;
      session.element.style.transform = `translate3d(${pageX - session.startPageX}px, ${pageY - session.startPageY}px, 0)`;

      const nextPosition = getPointerGridPosition({
        columns,
        clientX: session.lastClientX,
        clientY: session.lastClientY,
        gridElement,
        offsetX: session.offsetX,
        offsetY: session.offsetY,
        rowHeight,
        widget: session.startPlacement,
      });

      if (
        nextPosition.x === session.previewPosition.x &&
        nextPosition.y === session.previewPosition.y
      ) {
        return;
      }

      session.previewPosition = nextPosition;
      setDragState({ id: session.id, previewPosition: nextPosition });
    }

    function runAutoScroll() {
      animationFrameRef.current = null;
      const session = sessionRef.current;
      if (!session) {
        return;
      }

      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const scrollAmount = getVerticalAutoScrollAmount(session.lastClientY, viewportHeight);
      if (scrollAmount === 0) {
        return;
      }

      const previousScrollY = window.scrollY;
      window.scrollBy(0, scrollAmount);
      updateDragPosition();
      if (window.scrollY !== previousScrollY) {
        animationFrameRef.current = window.requestAnimationFrame(runAutoScroll);
      }
    }

    function updateAutoScroll() {
      const session = sessionRef.current;
      if (!session) {
        return;
      }

      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const scrollAmount = getVerticalAutoScrollAmount(session.lastClientY, viewportHeight);
      if (scrollAmount === 0) {
        cancelAutoScroll();
      } else if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(runAutoScroll);
      }
    }

    function moveWidget(event) {
      const session = sessionRef.current;
      if (!session || event.pointerId !== session.pointerId) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }
      session.lastClientX = event.clientX;
      session.lastClientY = event.clientY;
      updateDragPosition();
      updateAutoScroll();
    }

    function finishDrag(commit) {
      const session = sessionRef.current;
      if (!session) {
        return;
      }

      cancelAutoScroll();
      session.element.style.removeProperty("transform");
      session.element.style.removeProperty("will-change");
      if (session.element.hasPointerCapture?.(session.pointerId)) {
        session.element.releasePointerCapture(session.pointerId);
      }
      document.body.classList.remove("dashboard-widget-dragging");
      sessionRef.current = null;
      setDragState(null);

      if (commit) {
        onDropRef.current(session.id, session.previewPosition);
      }
    }

    function endDrag(event) {
      if (event.pointerId === sessionRef.current?.pointerId) {
        finishDrag(true);
      }
    }

    function cancelDrag(event) {
      if (event.pointerId === sessionRef.current?.pointerId) {
        finishDrag(false);
      }
    }

    function cancelAutoScroll() {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    window.addEventListener("pointermove", moveWidget, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", cancelDrag);

    return () => {
      window.removeEventListener("pointermove", moveWidget);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", cancelDrag);
      cancelAutoScroll();

      const session = sessionRef.current;
      if (session) {
        session.element.style.removeProperty("transform");
        session.element.style.removeProperty("will-change");
      }
      document.body.classList.remove("dashboard-widget-dragging");
    };
  }, [columns, dragState?.id, gridRef, rowHeight]);

  return { dragState, startDrag };
}

/**
 * Returns bounded vertical scroll distance for one animation frame.
 *
 * @param {number} clientY - Pointer position within the viewport.
 * @param {number} viewportHeight - Current viewport height.
 * @returns {number}
 */
export function getVerticalAutoScrollAmount(clientY, viewportHeight) {
  if (clientY < AUTO_SCROLL_EDGE_PX) {
    const proximity = clamp((AUTO_SCROLL_EDGE_PX - Math.max(0, clientY)) / AUTO_SCROLL_EDGE_PX, 0, 1);
    return -AUTO_SCROLL_MAX_PX_PER_FRAME * proximity;
  }

  if (clientY > viewportHeight - AUTO_SCROLL_EDGE_PX) {
    const proximity = clamp(
      (Math.min(viewportHeight, clientY) - (viewportHeight - AUTO_SCROLL_EDGE_PX)) /
        AUTO_SCROLL_EDGE_PX,
      0,
      1,
    );
    return AUTO_SCROLL_MAX_PX_PER_FRAME * proximity;
  }

  return 0;
}

function getPointerGridPosition({
  columns,
  clientX,
  clientY,
  gridElement,
  offsetX,
  offsetY,
  rowHeight,
  widget,
}) {
  const gridRect = gridElement.getBoundingClientRect();
  const columnWidth = (gridRect.width - GRID_GAP * (columns - 1)) / columns;
  const columnPitch = columnWidth + GRID_GAP;
  const rowPitch = rowHeight + GRID_GAP;
  const rawX = (clientX - gridRect.left - offsetX + columnWidth / 2) / columnPitch;
  const rawY = (clientY - gridRect.top - offsetY + rowHeight / 2) / rowPitch;

  return {
    x: clamp(Math.floor(rawX), 0, columns - widget.w),
    y: Math.max(0, Math.floor(rawY)),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * @typedef {object} DashboardDragState
 * @property {string} id
 * @property {{x: number, y: number}} previewPosition
 */

/**
 * @typedef {object} StartDragArgs
 * @property {boolean} editMode
 * @property {PointerEvent} event
 * @property {{id: string, x: number, y: number, w: number, h: number}} placement
 */
