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
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_CHART_HISTORY_BYTES } from "../storage/chartHistoryStorage.js";
import { retainLatestResultSeriesData, useScriptResultSeriesData } from "../hooks/useScriptResultSeriesData.js";

describe("Script result chart data", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps only the latest 256 KiB of endpoint points", () => {
    const points = Array.from({ length: 20_000 }, (_item, index) => ({ t: index, y: index / 10 }));
    const retained = retainLatestResultSeriesData([{
      id: "script-result-voltage",
      label: "voltage",
      color: "#2563eb",
      points,
    }]);

    expect(JSON.stringify({ series: retained }).length).toBeLessThanOrEqual(MAX_CHART_HISTORY_BYTES);
    expect(retained[0].points.at(-1)).toEqual(points.at(-1));
    expect(retained[0].points[0].t).toBeGreaterThan(points[0].t);
  });

  it("loads endpoint points through an offset and limit page", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        name: "voltage",
        unit: "V",
        points: [
          { timestamp: 1_785_318_429.97, value: 12.5 },
          { timestamp: "2026-07-29T12:00:30Z", value: 12.6 },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useScriptResultSeriesData({
      seriesUrl: "http://runner.test/api/scripts/task/series?series=voltage",
      series: { id: "voltage", label: "Voltage", lineColor: "#2563eb" },
    }));

    await waitFor(() => expect(result.current.statusText).toBe("Loaded 2 points"));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://runner.test/api/scripts/task/series?series=voltage&offset=0&limit=1024",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
    expect(result.current.unit).toBe("V");
    expect(result.current.seriesData[0].points).toEqual([
      { t: 1_785_318_429_970, y: 12.5 },
      { t: Date.parse("2026-07-29T12:00:30Z"), y: 12.6 },
    ]);
  });

  it("loads every selected series while applying the 256 KiB cap to each one", async () => {
    vi.stubGlobal("fetch", vi.fn((url) => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        unit: "V",
        points: [{ timestamp: url.includes("series=voltage") ? 1_785_318_429 : 1_785_318_430, value: url.includes("series=voltage") ? 12.5 : 1.2 }],
      }),
    })));

    const { result } = renderHook(() => useScriptResultSeriesData({
      series: [
        { id: "voltage", label: "voltage", lineColor: "#2563eb", seriesUrl: "http://runner.test/series?series=voltage" },
        { id: "current", label: "current", lineColor: "#0f766e", seriesUrl: "http://runner.test/series?series=current" },
      ],
    }));

    await waitFor(() => expect(result.current.statusText).toBe("Loaded 2 points"));
    expect(result.current.seriesData).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "voltage", points: [{ t: 1_785_318_429_000, y: 12.5 }] }),
      expect.objectContaining({ id: "current", points: [{ t: 1_785_318_430_000, y: 1.2 }] }),
    ]));
    expect(result.current.usageText).toContain("256 KiB per series");
  });
});
