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

const EXPORT_SCALE = 2;
const BACKGROUND_COLOR = "#f1f5f9";
const TEXT_COLOR = "#475569";
const MUTED_TEXT_COLOR = "#64748b";
const PANEL_BACKGROUND = "rgba(248, 250, 252, 0.94)";
const PANEL_BORDER = "#e2e8f0";
const STAT_ROWS_PER_COLUMN = 4;

/**
 * @typedef {object} ChartCursorPointSnapshot
 * @property {number} x
 * @property {number} y
 * @property {number} radius
 * @property {string} fill
 * @property {string} stroke
 * @property {number} strokeWidth
 */

/**
 * @typedef {object} ChartCursorOverlaySnapshot
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 * @property {number} x
 * @property {number} y
 * @property {ChartCursorPointSnapshot[]} points
 */

/**
 * Copies the currently rendered uPlot canvas and draws PSU-FE overlays into a PNG canvas.
 * All reads and drawing occur synchronously so live updates cannot alter the snapshot.
 *
 * @param {object} snapshot
 * @param {HTMLElement} snapshot.rootElement
 * @param {HTMLCanvasElement} snapshot.plotCanvas
 * @param {string} snapshot.headerText
 * @param {string} snapshot.usageText
 * @param {Array<{color?: string, label: string, value: string}>} snapshot.legendRows
 * @param {ChartCursorOverlaySnapshot | null} snapshot.cursorOverlay
 * @param {{title: string, rows: Array<{id: string, label: string, value: string}>} | null} snapshot.statistics
 * @returns {HTMLCanvasElement}
 */
export function composeChartPngCanvas({
  cursorOverlay,
  headerText,
  legendRows = [],
  plotCanvas,
  rootElement,
  statistics,
  usageText,
}) {
  const rootRect = rootElement.getBoundingClientRect();
  const cssWidth = Math.max(1, Math.ceil(rootRect.width || rootElement.clientWidth));
  const cssHeight = Math.max(1, Math.ceil(rootRect.height || rootElement.clientHeight));
  const canvas = document.createElement("canvas");
  canvas.width = cssWidth * EXPORT_SCALE;
  canvas.height = cssHeight * EXPORT_SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable.");

  context.scale(EXPORT_SCALE, EXPORT_SCALE);
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, cssWidth, cssHeight);

  const plotRect = plotCanvas.getBoundingClientRect();
  const plotWidth = plotRect.width || cssWidth;
  const plotHeight = plotRect.height || cssHeight;
  context.drawImage(
    plotCanvas,
    plotRect.left - rootRect.left,
    plotRect.top - rootRect.top,
    plotWidth,
    plotHeight,
  );

  drawCursorOverlay(context, cursorOverlay);
  drawHeader(context, { cssWidth, headerText, usageText });
  drawLegend(context, { cssHeight, cssWidth, legendRows });
  drawStatistics(context, { cssWidth, statistics });
  return canvas;
}

/**
 * Snapshots uPlot's locked DOM cursor so it can be composited with the plot canvas.
 * uPlot intentionally renders crosshairs and selected points outside its canvas.
 *
 * @param {object} plot
 * @param {HTMLElement} rootElement
 * @returns {ChartCursorOverlaySnapshot | null}
 */
export function createUplotCursorOverlay(plot, rootElement) {
  const cursor = plot?.cursor;
  const over = plot?.over;
  if (!cursor?._lock || !over || !rootElement || !Number.isFinite(cursor.left) || !Number.isFinite(cursor.top)) {
    return null;
  }

  // uPlot keeps cursor lock state in `_lock`; unlocked overlays can retain stale DOM geometry.
  const rootRect = rootElement.getBoundingClientRect();
  const overRect = over.getBoundingClientRect();
  const left = overRect.left - rootRect.left;
  const top = overRect.top - rootRect.top;
  const points = Array.from(over.querySelectorAll(".u-cursor-pt:not(.u-off)"))
    .map((element) => cursorPointSnapshot(element, rootRect))
    .filter(Boolean);

  return {
    left,
    top,
    width: overRect.width,
    height: overRect.height,
    x: left + cursor.left,
    y: top + cursor.top,
    points,
  };
}

/**
 * Creates the visible uPlot legend rows from the plot's public readback state.
 *
 * @param {object} plot
 * @param {Array<{color?: string}>} seriesData
 * @returns {Array<{color?: string, label: string, value: string}>}
 */
export function createUplotLegendRows(plot, seriesData = []) {
  return (plot?.series || []).map((series, index) => ({
    color: index > 0 ? seriesData[index - 1]?.color : undefined,
    label: String(series?.label || (index === 0 ? "T" : `Series ${index}`)),
    value: firstLegendValue(plot?.legend?.values?.[index]),
  }));
}

/**
 * Encodes and downloads a composed PNG canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} fileName
 * @returns {Promise<void>}
 */
export async function downloadChartPng(canvas, fileName) {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

/**
 * Creates a safe timestamped PNG filename.
 *
 * @param {string} fileStem
 * @param {Date} [date]
 * @returns {string}
 */
export function createChartPngFileName(fileStem, date = new Date()) {
  const safeStem = String(fileStem || "chart")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "chart";
  return `${safeStem}-${formatTimestamp(date)}.png`;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode chart image."));
    }, "image/png");
  });
}

function drawHeader(context, { cssWidth, headerText, usageText }) {
  const left = 66;
  const right = cssWidth - 12;
  context.font = "12px system-ui, sans-serif";
  context.textBaseline = "top";
  context.fillStyle = MUTED_TEXT_COLOR;
  context.textAlign = "right";
  context.fillText(usageText || "", right, 8);
  const usageWidth = context.measureText(usageText || "").width;
  const headerRight = right - usageWidth - 12;
  context.fillStyle = TEXT_COLOR;
  drawEllipsizedText(context, headerText || "", headerRight, 8, Math.max(0, headerRight - left), "right");
}

function drawCursorOverlay(context, overlay) {
  if (!overlay) return;

  context.save();
  context.strokeStyle = "#607d8b";
  context.lineWidth = 1;
  context.setLineDash([3, 3]);
  context.beginPath();
  context.moveTo(overlay.x + 0.5, overlay.top);
  context.lineTo(overlay.x + 0.5, overlay.top + overlay.height);
  context.moveTo(overlay.left, overlay.y + 0.5);
  context.lineTo(overlay.left + overlay.width, overlay.y + 0.5);
  context.stroke();
  context.setLineDash([]);

  overlay.points.forEach((point) => {
    context.beginPath();
    context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
    context.fillStyle = point.fill;
    context.fill();
    if (point.strokeWidth > 0) {
      context.strokeStyle = point.stroke;
      context.lineWidth = point.strokeWidth;
      context.stroke();
    }
  });
  context.restore();
}

function drawLegend(context, { cssHeight, cssWidth, legendRows }) {
  if (!legendRows.length) return;
  context.font = "11px system-ui, sans-serif";
  const valueWidth = Math.ceil(Math.max(48, ...legendRows.map((row) => context.measureText(row.value).width)));
  const desiredWidth = Math.ceil(Math.max(160, ...legendRows.map((row) => (
    20
    + (row.color ? 16 : 0)
    + context.measureText(row.label).width
    + valueWidth
  ))));
  const width = Math.min(desiredWidth, Math.max(100, cssWidth - 8));
  const rowHeight = 17;
  const height = legendRows.length * rowHeight + 8;
  const left = cssWidth - width - 4;
  const top = Math.max(4, cssHeight - height - 4);
  drawPanel(context, left, top, width, height);
  context.textBaseline = "middle";
  legendRows.forEach((row, index) => {
    const y = top + 4 + index * rowHeight + rowHeight / 2;
    const markerWidth = row.color ? 12 : 0;
    if (row.color) {
      context.strokeStyle = row.color;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(left + 6, y);
      context.lineTo(left + 18, y);
      context.stroke();
    }
    const labelLeft = left + 6 + markerWidth + (markerWidth ? 4 : 0);
    const labelWidth = Math.max(0, left + width - 14 - valueWidth - labelLeft);
    context.fillStyle = TEXT_COLOR;
    drawEllipsizedText(context, row.label, labelLeft, y, labelWidth, "left");
    context.fillStyle = MUTED_TEXT_COLOR;
    drawEllipsizedText(context, row.value, left + width - 6, y, valueWidth, "right");
  });
}

function drawStatistics(context, { cssWidth, statistics }) {
  if (!statistics?.rows?.length) return;
  const columnCount = Math.ceil(statistics.rows.length / STAT_ROWS_PER_COLUMN);
  const desiredWidth = 16 + columnCount * 144 + Math.max(0, columnCount - 1) * 12;
  const width = Math.min(Math.max(1, cssWidth - 24), Math.max(160, desiredWidth));
  const rowCount = Math.min(STAT_ROWS_PER_COLUMN, statistics.rows.length);
  const titleHeight = 23;
  const rowHeight = 16;
  const height = titleHeight + 10 + rowCount * rowHeight;
  const left = Math.max(12, cssWidth - width - 12);
  const top = 32;
  drawPanel(context, left, top, width, height);

  context.fillStyle = MUTED_TEXT_COLOR;
  context.font = "600 10px system-ui, sans-serif";
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.fillText(String(statistics.title || "Statistics").toUpperCase(), left + 8, top + titleHeight / 2);
  context.strokeStyle = PANEL_BORDER;
  context.beginPath();
  context.moveTo(left, top + titleHeight);
  context.lineTo(left + width, top + titleHeight);
  context.stroke();

  const availableWidth = width - 16 - Math.max(0, columnCount - 1) * 12;
  const columnWidth = availableWidth / columnCount;
  context.font = "11px system-ui, sans-serif";
  statistics.rows.forEach((row, index) => {
    const column = Math.floor(index / STAT_ROWS_PER_COLUMN);
    const rowIndex = index % STAT_ROWS_PER_COLUMN;
    const columnLeft = left + 8 + column * (columnWidth + 12);
    const y = top + titleHeight + 7 + rowIndex * rowHeight + rowHeight / 2;
    context.fillStyle = MUTED_TEXT_COLOR;
    drawEllipsizedText(context, row.label, columnLeft, y, Math.max(24, columnWidth - 58), "left");
    context.fillStyle = "#1e293b";
    context.font = "500 11px system-ui, sans-serif";
    drawEllipsizedText(context, row.value, columnLeft + columnWidth, y, 54, "right");
    context.font = "11px system-ui, sans-serif";
  });
}

function drawPanel(context, left, top, width, height) {
  context.fillStyle = PANEL_BACKGROUND;
  context.fillRect(left, top, width, height);
  context.strokeStyle = PANEL_BORDER;
  context.lineWidth = 1;
  context.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);
}

function drawEllipsizedText(context, value, x, y, maxWidth, align) {
  if (maxWidth <= 0) return;
  const text = String(value || "");
  context.textAlign = align;
  if (context.measureText(text).width <= maxWidth) {
    context.fillText(text, x, y);
    return;
  }
  let shortened = text;
  while (shortened.length && context.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  context.fillText(`${shortened}…`, x, y);
}

function firstLegendValue(values) {
  if (!values || typeof values !== "object") return "--";
  const value = Object.values(values)[0];
  return value == null || value === "" ? "--" : String(value);
}

function cursorPointSnapshot(element, rootRect) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || Number(style.opacity) === 0) return null;

  return {
    x: rect.left - rootRect.left + rect.width / 2,
    y: rect.top - rootRect.top + rect.height / 2,
    radius: Math.max(rect.width, rect.height) / 2,
    fill: style.backgroundColor || "transparent",
    stroke: style.borderColor || "transparent",
    strokeWidth: Number.parseFloat(style.borderWidth) || 0,
  };
}

function formatTimestamp(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function pad(value) {
  return String(value).padStart(2, "0");
}
