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
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import uPlot from "uplot";
import { toXyUplotData } from "../utils/xyPlotData.js";
import { createXyUplotOptions } from "../utils/xyUplotOptions.js";

// Runs the options against the real uPlot instead of the mock used by the renderer tests, so option values that
// uPlot itself rejects (for example a class name containing a space) fail here. jsdom has no canvas, so drawing
// calls go to a no-op 2D context.
const POINTS = [
  { x: 1, y: 0.1, t: 1 },
  { x: 2, y: 0.2, t: 2 },
  { x: 3, y: 0.3, t: 3 },
];

function noopContext() {
  return new Proxy(
    {},
    {
      get: (target, key) => {
        if (key in target) return target[key];
        if (key === "measureText") return () => ({ width: 10 });
        return () => {};
      },
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  );
}

function createPlot(showProduct, onCursorPoint) {
  const root = document.createElement("div");
  document.body.append(root);
  return new uPlot(
    createXyUplotOptions({
      height: 200,
      lineColor: "#2563eb",
      onCursorPoint,
      productAxis: { label: "Power", unit: "W" },
      showLine: true,
      showProduct,
      statusText: "",
      width: 400,
      xAxis: { label: "Voltage", unit: "V" },
      yAxis: { label: "Current", unit: "A" },
    }),
    toXyUplotData(POINTS, showProduct).data,
    root,
  );
}

function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("X-Y uPlot options with the real uPlot", () => {
  const plots = [];

  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = () => noopContext();
    globalThis.Path2D ??= class {
      moveTo() {}
      lineTo() {}
      arc() {}
      rect() {}
      closePath() {}
    };
  });

  afterEach(() => {
    for (const plot of plots.splice(0)) plot.destroy();
    document.body.innerHTML = "";
  });

  it.each([false, true])("builds the plot and reports the hovered point (X·Y line %s)", async (showProduct) => {
    const onCursorPoint = vi.fn();
    const plot = createPlot(showProduct, onCursorPoint);
    plots.push(plot);
    await nextTick();

    plot.setCursor({ left: plot.valToPos(2, "x") + 2, top: plot.valToPos(0.2, "y") + 2 });
    expect(onCursorPoint).toHaveBeenLastCalledWith(1);

    plot.setCursor({ left: -10, top: -10 });
    expect(onCursorPoint).toHaveBeenLastCalledWith(null);
  });
});
