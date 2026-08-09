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
/**
 * Reports whether a placement stays within the grid and avoids other widgets.
 *
 * @param {object} candidate
 * @param {Array<object>} layout
 * @param {number} columns
 * @returns {boolean}
 */
export function isPlacementAvailable(candidate, layout, columns) {
  if (candidate.x < 0 || candidate.x + candidate.w > columns || candidate.y < 0) {
    return false;
  }

  return layout.every((widget) => widget.id === candidate.id || !rectanglesOverlap(candidate, widget));
}

/**
 * Finds the first free grid position for a widget.
 *
 * @param {object} widget
 * @param {Array<object>} layout
 * @param {number} columns
 * @returns {object}
 */
export function findAvailablePlacement(widget, layout, columns) {
  if (isPlacementAvailable(widget, layout, columns)) {
    return widget;
  }

  for (let y = 0; y < 99; y += 1) {
    for (let x = 0; x <= columns - widget.w; x += 1) {
      const candidate = { ...widget, x, y };
      if (isPlacementAvailable(candidate, layout, columns)) {
        return candidate;
      }
    }
  }

  return { ...widget, x: 0, y: Math.max(0, ...layout.map((item) => item.y + item.h)) };
}

/**
 * Normalizes the immutable widget set used by a static dashboard.
 *
 * @param {Array<object>} candidateLayout
 * @param {Array<object>} defaultLayout
 * @param {number} columns
 * @returns {Array<object>}
 */
export function normalizeStaticLayout(candidateLayout, defaultLayout, columns) {
  const occupied = [];

  return defaultLayout.map((defaultWidget) => {
    const candidateWidget = Array.isArray(candidateLayout)
      ? candidateLayout.find((widget) => widget.id === defaultWidget.id)
      : null;
    const normalizedWidget = normalizeWidgetPlacement(
      { ...defaultWidget, ...candidateWidget, type: defaultWidget.type },
      defaultWidget,
      columns,
    );
    const fallbackWidget = normalizeWidgetPlacement(defaultWidget, defaultWidget, columns);
    const placement = isPlacementAvailable(normalizedWidget, occupied, columns)
      ? normalizedWidget
      : findAvailablePlacement(fallbackWidget, occupied, columns);

    occupied.push(placement);
    return placement;
  });
}

/**
 * Normalizes user-added widgets and removes unknown or overlapping entries.
 *
 * @param {Array<object>} candidateLayout
 * @param {Record<string, unknown>} widgets
 * @param {number} columns
 * @returns {Array<object>}
 */
export function normalizeDynamicLayout(candidateLayout, widgets, columns) {
  const occupied = [];

  if (!Array.isArray(candidateLayout)) {
    return occupied;
  }

  for (const candidateWidget of candidateLayout) {
    if (!candidateWidget?.id || !widgets[candidateWidget.type]) {
      continue;
    }

    const normalizedWidget = normalizeWidgetPlacement(candidateWidget, candidateWidget, columns);
    if (!isPlacementAvailable(normalizedWidget, occupied, columns)) {
      continue;
    }

    occupied.push(normalizedWidget);
  }

  return occupied;
}

function normalizeWidgetPlacement(widget, fallback, columns) {
  const w = clamp(toInteger(widget.w, fallback.w), 1, columns);
  const h = clamp(toInteger(widget.h, fallback.h), 1, 3);
  const x = clamp(toInteger(widget.x, fallback.x), 0, columns - w);
  const y = Math.max(0, toInteger(widget.y, fallback.y));

  return { ...widget, id: fallback.id, type: fallback.type, x, y, w, h };
}

function rectanglesOverlap(first, second) {
  return (
    first.x < second.x + second.w &&
    first.x + first.w > second.x &&
    first.y < second.y + second.h &&
    first.y + first.h > second.y
  );
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
