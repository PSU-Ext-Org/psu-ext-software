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
  CHART_HISTORY_STORAGE_KEY,
  formatChartHistoryUsage,
  MAX_CHART_HISTORY_BYTES,
  getChartHistoryUsageBytes,
  deleteChartHistory,
  loadChartHistories,
  loadChartHistory,
  pruneChartHistory,
  saveChartHistory,
} from "../storage/chartHistoryStorage.js";

const CONFIG = {
  series: [
    {
      id: "voltage",
      label: "Voltage",
      deviceName: "PSU1",
      query: "MEAS:VOLT?",
      lineColor: "#2563eb",
    },
  ],
};

describe("chart history storage", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads empty history for empty or malformed storage", () => {
    expect(loadChartHistory("chart-main", CONFIG)).toEqual([
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [],
      },
    ]);

    window.localStorage.setItem(CHART_HISTORY_STORAGE_KEY, "{not json");

    expect(loadChartHistories()).toEqual({});
  });

  it("saves and restores widget-specific history", () => {
    saveChartHistory("chart-main", CONFIG, [
      {
        id: "voltage",
        label: "Old label",
        color: "#000000",
        points: [{ t: 1000, y: 12.4 }],
      },
    ]);

    expect(loadChartHistory("chart-main", CONFIG)).toEqual([
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [{ t: 1000, y: 12.4 }],
      },
    ]);
    expect(loadChartHistory("chart-other", CONFIG)[0].points).toEqual([]);
  });

  it("drops incompatible history when device or query changes", () => {
    saveChartHistory("chart-main", CONFIG, [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [{ t: 1000, y: 12.4 }],
      },
    ]);

    expect(
      loadChartHistory("chart-main", {
        series: [{ ...CONFIG.series[0], query: "MEAS:CURR?" }],
      })[0].points,
    ).toEqual([]);
  });

  it("prunes chart history to the 256KB cap", () => {
    const points = Array.from({ length: 20_000 }, (_item, index) => ({
      t: index,
      y: index / 10,
    }));

    const pruned = pruneChartHistory([
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points,
      },
    ]);

    expect(JSON.stringify({ series: pruned }).length).toBeLessThanOrEqual(MAX_CHART_HISTORY_BYTES);
    expect(pruned[0].points.at(-1)).toEqual(points.at(-1));
  });

  it("prunes chart history to the configured per-widget cap and keeps newest points", () => {
    const points = Array.from({ length: 200 }, (_item, index) => ({
      t: index,
      y: index / 10,
    }));

    const pruned = pruneChartHistory(
      [
        {
          id: "voltage",
          label: "Voltage",
          color: "#2563eb",
          points,
        },
      ],
      1024,
    );

    expect(JSON.stringify({ series: pruned }).length).toBeLessThanOrEqual(1024);
    expect(pruned[0].points.at(-1)).toEqual(points.at(-1));
    expect(pruned[0].points[0].t).toBeGreaterThan(points[0].t);
  });

  it("reports current history usage against the configured cap", () => {
    const seriesData = [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [{ t: 1000, y: 12.4 }],
      },
    ];

    const usageBytes = getChartHistoryUsageBytes({ ...CONFIG, historyLimitBytes: MAX_CHART_HISTORY_BYTES }, seriesData);

    expect(usageBytes).toBeGreaterThan(0);
    expect(formatChartHistoryUsage(usageBytes, MAX_CHART_HISTORY_BYTES)).toContain("/ 256 KiB");
  });

  it("deletes one widget history and dispatches a change event", () => {
    const listener = vi.fn();
    window.addEventListener("psu-ext-chart-history-change", listener);
    saveChartHistory("chart-main", CONFIG, [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [{ t: 1000, y: 12.4 }],
      },
    ]);
    saveChartHistory("chart-other", CONFIG, [
      {
        id: "voltage",
        label: "Voltage",
        color: "#2563eb",
        points: [{ t: 2000, y: 12.5 }],
      },
    ]);

    deleteChartHistory("chart-main");

    expect(loadChartHistories()).toHaveProperty("chart-other");
    expect(loadChartHistories()).not.toHaveProperty("chart-main");
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { action: "delete", widgetId: "chart-main" },
      }),
    );
    window.removeEventListener("psu-ext-chart-history-change", listener);
  });
});
