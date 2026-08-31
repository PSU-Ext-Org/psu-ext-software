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
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  composeChartPngCanvas,
  createChartPngFileName,
  createUplotCursorOverlay,
  createUplotLegendRows,
  downloadChartPng,
} from "../export/chartImageExport.js";

describe("chart image export", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("copies the current plot canvas and draws metadata, legend, and statistics at 2x", () => {
    const drawing = createDrawingContext();
    const exportCanvas = { getContext: () => drawing, height: 0, width: 0 };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => (
      tagName === "canvas" ? exportCanvas : originalCreateElement(tagName, options)
    ));
    const plotCanvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    plotCanvas.getBoundingClientRect = () => ({ bottom: 154, height: 150, left: 10, right: 650, top: 4, width: 640 });
    const rootElement = {
      clientHeight: 150,
      clientWidth: 640,
      getBoundingClientRect: () => ({ bottom: 150, height: 150, left: 0, right: 640, top: 0, width: 640 }),
    };

    const result = composeChartPngCanvas({
      cursorOverlay: {
        height: 100,
        left: 60,
        points: [{ fill: "rgb(255, 86, 48)", radius: 4, stroke: "rgb(255, 86, 48)", strokeWidth: 0, x: 235, y: 85 }],
        top: 26,
        width: 570,
        x: 235,
        y: 85,
      },
      headerText: "PSU1 MEAS:VOLT?",
      legendRows: [
        { label: "T", value: "13:57:04.123" },
        { color: "#2563eb", label: "Voltage", value: "12.0400 V" },
      ],
      plotCanvas,
      rootElement,
      statistics: { title: "Voltage stats", rows: [{ id: "min", label: "Min", value: "12.0400 V" }] },
      usageText: "1.2 / 256 KiB",
    });

    expect(result).toBe(exportCanvas);
    expect(exportCanvas).toMatchObject({ width: 1280, height: 300 });
    expect(drawing.scale).toHaveBeenCalledWith(2, 2);
    expect(drawing.drawImage).toHaveBeenCalledWith(plotCanvas, 10, 4, 640, 150);
    expect(drawing.setLineDash).toHaveBeenCalledWith([3, 3]);
    expect(drawing.arc).toHaveBeenCalledWith(235, 85, 4, 0, Math.PI * 2);
    const drawnText = drawing.fillText.mock.calls.map(([value]) => value);
    expect(drawnText).toEqual(expect.arrayContaining([
      "PSU1 MEAS:VOLT?",
      "1.2 / 256 KiB",
      "Voltage",
      "12.0400 V",
      "13:57:04.123",
      "VOLTAGE STATS",
      "Min",
    ]));
    expect(drawnText).not.toContain(expect.stringContaining("13:57:0…"));
  });

  it("snapshots the locked uPlot crosshair and visible cursor points", () => {
    const point = document.createElement("div");
    point.className = "u-cursor-pt";
    point.style.backgroundColor = "rgb(255, 86, 48)";
    point.style.border = "2px solid rgb(30, 41, 59)";
    point.getBoundingClientRect = () => ({ height: 8, left: 231, top: 81, width: 8 });
    const over = document.createElement("div");
    over.append(point);
    over.getBoundingClientRect = () => ({ height: 100, left: 60, top: 26, width: 570 });
    const rootElement = {
      getBoundingClientRect: () => ({ left: 10, top: 4 }),
    };

    expect(createUplotCursorOverlay({
      cursor: { _lock: true, left: 175, top: 59 },
      over,
    }, rootElement)).toEqual({
      height: 100,
      left: 50,
      points: [{
        fill: "rgb(255, 86, 48)",
        radius: 4,
        stroke: "rgb(30, 41, 59)",
        strokeWidth: 2,
        x: 225,
        y: 81,
      }],
      top: 22,
      width: 570,
      x: 225,
      y: 81,
    });
  });

  it("omits an unlocked uPlot cursor", () => {
    expect(createUplotCursorOverlay({ cursor: { _lock: false } }, document.body)).toBeNull();
  });

  it("reads the current public uPlot legend values", () => {
    expect(createUplotLegendRows({
      legend: { values: [{ _: "03:04:05.006" }, { _: "12.0400 V" }] },
      series: [{ label: "T" }, { label: "Voltage" }],
    }, [{ color: "#2563eb" }])).toEqual([
      { color: undefined, label: "T", value: "03:04:05.006" },
      { color: "#2563eb", label: "Voltage", value: "12.0400 V" },
    ]);
  });

  it("creates sanitized local timestamp filenames", () => {
    expect(createChartPngFileName("  Voltage / Output #1  ", new Date(2026, 6, 9, 8, 7, 6))).toBe(
      "voltage-output-1-20260709-080706.png",
    );
  });

  it("downloads a PNG blob and cleans up its temporary URL", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const canvas = { toBlob: (callback, type) => { expect(type).toBe("image/png"); callback(blob); } };
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:chart"),
      revokeObjectURL: vi.fn(),
    });

    await downloadChartPng(canvas, "chart.png");

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:chart");
    expect(document.querySelector('a[href="blob:chart"]')).not.toBeInTheDocument();
  });

  it("rejects when PNG encoding returns no blob", async () => {
    await expect(downloadChartPng({ toBlob: (callback) => callback(null) }, "chart.png")).rejects.toThrow(
      "Could not encode chart image.",
    );
  });
});

function createDrawingContext() {
  return {
    arc: vi.fn(),
    beginPath: vi.fn(),
    drawImage: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    measureText: vi.fn((value) => ({ width: String(value).length * 6 })),
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
  };
}
