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
import { clearDeviceScpiHistory } from "./widgetScpiHistory.js";
import { CHART_HISTORY_STORAGE_KEY } from "./chart/storage/chartHistoryStorage.js";
import { XY_CHART_HISTORY_STORAGE_KEY } from "./xyChart/storage/xyChartHistoryStorage.js";
import { WIDGET_CONFIG_STORAGE_KEY } from "./widgetConfigStore.js";

function read(key) {
  return JSON.parse(window.localStorage.getItem(key));
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("unmounted widget history cleanup", () => {
  it("clears only the unavailable device until the remaining device is reset", () => {
    const config = { chart: { cardName: "Measurements" } };
    localStorage.setItem(WIDGET_CONFIG_STORAGE_KEY, JSON.stringify(config));
    localStorage.setItem(CHART_HISTORY_STORAGE_KEY, JSON.stringify({ chart: { series: [
      { deviceName: "USB1", points: [{ t: 1, y: 12 }] },
      { deviceName: "PSU1", points: [{ t: 1, y: 5 }] },
    ] } }));
    localStorage.setItem(XY_CHART_HISTORY_STORAGE_KEY, JSON.stringify({
      mixed: { x: { deviceName: "USB1" }, y: { deviceName: "PSU1" }, points: [{ x: 12, y: 5, t: 1 }] },
      healthy: { x: { deviceName: "PSU1" }, y: { deviceName: "PSU1" }, points: [{ x: 5, y: 1, t: 1 }] },
    }));

    clearDeviceScpiHistory("USB1");

    const saved = read(CHART_HISTORY_STORAGE_KEY);
    expect(saved.chart.series[0].points).toEqual([]);
    expect(saved.chart.series[1].points).toHaveLength(1);
    expect(Object.keys(read(XY_CHART_HISTORY_STORAGE_KEY))).toEqual(["healthy"]);
    expect(read(WIDGET_CONFIG_STORAGE_KEY)).toEqual(config);

    clearDeviceScpiHistory("PSU1");

    expect(read(CHART_HISTORY_STORAGE_KEY).chart.series[1].points).toEqual([]);
    expect(read(XY_CHART_HISTORY_STORAGE_KEY)).toEqual({});
    expect(read(WIDGET_CONFIG_STORAGE_KEY)).toEqual(config);
  });

  it.each(["x", "y"])("clears X-Y history when the %s source disconnects", (axis) => {
    localStorage.setItem(XY_CHART_HISTORY_STORAGE_KEY, JSON.stringify({
      xy: {
        x: { deviceName: "PSU1" },
        y: { deviceName: "PSU1" },
        [axis]: { deviceName: "USB1" },
        points: [{ x: 1, y: 2 }],
      },
    }));
    clearDeviceScpiHistory("USB1");
    expect(read(XY_CHART_HISTORY_STORAGE_KEY)).toEqual({});
  });

  it("continues X-Y cleanup when chart history is malformed", () => {
    localStorage.setItem(CHART_HISTORY_STORAGE_KEY, "invalid");
    localStorage.setItem(XY_CHART_HISTORY_STORAGE_KEY, JSON.stringify({
      xy: { x: { deviceName: "USB1" }, points: [{ x: 1, y: 2 }] },
    }));
    expect(() => clearDeviceScpiHistory("USB1")).not.toThrow();
    expect(read(XY_CHART_HISTORY_STORAGE_KEY)).toEqual({});
  });

  it("tolerates unavailable storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage disabled");
    });
    expect(() => clearDeviceScpiHistory("USB1")).not.toThrow();
  });
});
