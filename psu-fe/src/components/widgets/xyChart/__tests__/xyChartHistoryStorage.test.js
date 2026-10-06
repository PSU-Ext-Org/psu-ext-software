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
  deleteXyChartHistory,
  getXyChartHistoryUsageBytes,
  loadXyChartHistory,
  pruneXyChartHistory,
  saveXyChartHistory,
  XY_CHART_HISTORY_CHANGE_EVENT,
  XY_CHART_HISTORY_STORAGE_KEY,
} from "../storage/xyChartHistoryStorage.js";

const CONFIG = {
  historyLimitBytes: 256 * 1024,
  x: { deviceName: "PSU1", query: "MEAS:VOLT? CH1" },
  y: { deviceName: "PSU1", query: "MEAS:CURR? CH1" },
};

function sweep(count) {
  return Array.from({ length: count }, (_value, index) => ({ x: index, y: index / 10, t: 1000 + index }));
}

describe("xy chart history storage", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("saves and loads points with their X and Y source", () => {
    saveXyChartHistory("xy-a", CONFIG, sweep(3));

    expect(loadXyChartHistory("xy-a", CONFIG)).toEqual(sweep(3));
    expect(JSON.parse(window.localStorage.getItem(XY_CHART_HISTORY_STORAGE_KEY))["xy-a"]).toMatchObject({
      x: CONFIG.x,
      y: CONFIG.y,
    });
  });

  it("ignores points recorded for a different device or query", () => {
    saveXyChartHistory("xy-a", CONFIG, sweep(3));

    expect(loadXyChartHistory("xy-a", { ...CONFIG, y: { deviceName: "PSU1", query: "MEAS:POW? CH1" } })).toEqual([]);
    expect(loadXyChartHistory("xy-a", { ...CONFIG, x: { deviceName: "PSU2", query: CONFIG.x.query } })).toEqual([]);
  });

  it("keeps acquisition order instead of sorting by time", () => {
    const points = [
      { x: 1, y: 1, t: 30 },
      { x: 2, y: 2, t: 10 },
    ];
    saveXyChartHistory("xy-a", CONFIG, points);

    expect(loadXyChartHistory("xy-a", CONFIG)).toEqual(points);
  });

  it("drops the oldest points to fit the byte cap", () => {
    const kept = pruneXyChartHistory(sweep(200), 2048, CONFIG);

    expect(kept.length).toBeLessThan(200);
    expect(kept.at(-1)).toEqual(sweep(200).at(-1));
    expect(getXyChartHistoryUsageBytes(CONFIG, kept)).toBeLessThanOrEqual(2048);
    expect(getXyChartHistoryUsageBytes(CONFIG, sweep(200))).toBeGreaterThan(2048);
  });

  it("removes the widget entry when no points are left", () => {
    saveXyChartHistory("xy-a", CONFIG, sweep(2));
    saveXyChartHistory("xy-a", CONFIG, []);

    expect(JSON.parse(window.localStorage.getItem(XY_CHART_HISTORY_STORAGE_KEY))).toEqual({});
    expect(getXyChartHistoryUsageBytes(CONFIG, [])).toBe(0);
  });

  it("deletes one widget's history and announces it", () => {
    const listener = vi.fn();
    window.addEventListener(XY_CHART_HISTORY_CHANGE_EVENT, listener);
    saveXyChartHistory("xy-a", CONFIG, sweep(2));
    saveXyChartHistory("xy-b", CONFIG, sweep(2));

    deleteXyChartHistory("xy-a");
    window.removeEventListener(XY_CHART_HISTORY_CHANGE_EVENT, listener);

    expect(loadXyChartHistory("xy-a", CONFIG)).toEqual([]);
    expect(loadXyChartHistory("xy-b", CONFIG)).toHaveLength(2);
    expect(listener.mock.calls[0][0].detail).toEqual({ action: "delete", widgetId: "xy-a" });
  });

  it("treats unreadable storage and invalid points as empty", () => {
    window.localStorage.setItem(XY_CHART_HISTORY_STORAGE_KEY, "not json");
    expect(loadXyChartHistory("xy-a", CONFIG)).toEqual([]);

    window.localStorage.setItem(
      XY_CHART_HISTORY_STORAGE_KEY,
      JSON.stringify({ "xy-a": { ...CONFIG, points: [{ x: 1, y: "bad", t: 1 }, { x: 2, y: 3, t: 4 }] } }),
    );
    expect(loadXyChartHistory("xy-a", CONFIG)).toEqual([{ x: 2, y: 3, t: 4 }]);
  });
});
