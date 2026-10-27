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
import { X_QUERY, Y_QUERY, createConfig, scheduler, renderData, publishPairs } from "./xyChartDataFixture.js";
import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useXyChartData } from "../hooks/useXyChartData.js";
import { deleteXyChartHistory, getXyChartHistoryUsageBytes, loadXyChartHistory } from "../storage/xyChartHistoryStorage.js";

describe("useXyChartData.history", () => {
  it("clears history and pending pairs on disconnect and starts with fresh samples", () => {
    const { result } = renderData();
    publishPairs(2);
    expect(result.current.points).toHaveLength(2);
    scheduler.publish(X_QUERY, { value: "9", updatedAt: 30 });
    scheduler.publish(Y_QUERY, { value: "", updatedAt: 0, disconnected: true });
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.points).toEqual([]);
    expect(loadXyChartHistory("xy-test", createConfig())).toEqual([]);
    scheduler.publish(Y_QUERY, { value: "4", updatedAt: 40 });
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.points).toEqual([]);
    scheduler.publish(X_QUERY, { value: "3", updatedAt: 50 });
    scheduler.publish(Y_QUERY, { value: "6", updatedAt: 51 });
    expect(result.current.points).toEqual([{ x: 3, y: 6, t: 51 }]);
  });

  it("stores each point and restores them on the next mount", () => {
    const first = renderData();
    publishPairs(2);
    expect(loadXyChartHistory("xy-test", createConfig())).toEqual(first.result.current.points);
    first.unmount();

    const { result } = renderData();

    expect(result.current.points).toEqual([
      { x: 1, y: 2, t: 11 },
      { x: 2, y: 4, t: 21 },
    ]);
  });

  it("keeps the newest points within the history cap", () => {
    const config = createConfig({ historyLimitBytes: 1024 });
    const { result } = renderData(config);

    publishPairs(60);

    const { points } = result.current;
    expect(points.length).toBeLessThan(60);
    expect(points[0].x).toBeGreaterThan(1);
    expect(points.at(-1)).toEqual({ x: 60, y: 120, t: 601 });
    expect(getXyChartHistoryUsageBytes(config, points)).toBeLessThanOrEqual(1024);
    expect(result.current.usageText).toMatch(/ \/ 1 KiB$/);
  });

  it("trims stored points when the history cap is lowered", () => {
    const { result, rerender } = renderData();
    publishPairs(60);
    expect(result.current.points).toHaveLength(60);

    rerender({ current: createConfig({ historyLimitBytes: 1024 }) });

    expect(result.current.points.length).toBeLessThan(60);
    expect(result.current.points.at(-1).x).toBe(60);
    expect(loadXyChartHistory("xy-test", createConfig())).toEqual(result.current.points);
  });

  it("keeps stored points when the pair timeout changes", () => {
    const { result, rerender } = renderData();
    publishPairs(2);

    rerender({ current: createConfig({ pairTimeoutMs: 300 }) });

    expect(result.current.points).toHaveLength(2);
  });

  it("clears points and storage, then keeps collecting", () => {
    const { result } = renderData();
    publishPairs(1);
    expect(result.current.points).toHaveLength(1);

    act(() => result.current.clear());
    expect(result.current.points).toEqual([]);
    expect(loadXyChartHistory("xy-test", createConfig())).toEqual([]);

    scheduler.publish(X_QUERY, { value: "3", updatedAt: 200 });
    scheduler.publish(Y_QUERY, { value: "4", updatedAt: 210 });
    expect(result.current.points).toEqual([{ x: 3, y: 4, t: 210 }]);
  });

  it("clears when the history of its widget id is deleted", () => {
    const { result } = renderData();
    publishPairs(1);
    expect(result.current.points).toHaveLength(1);

    act(() => deleteXyChartHistory("another-widget"));
    expect(result.current.points).toHaveLength(1);

    act(() => deleteXyChartHistory("xy-test"));
    expect(result.current.points).toEqual([]);
  });

  it("discards points when a query changes", () => {
    const { result, rerender } = renderData();
    publishPairs(1);
    expect(result.current.points).toHaveLength(1);

    rerender({ current: createConfig({ y: { deviceName: "PSU1", query: "MEAS:POW? CH1" } }) });

    expect(result.current.points).toEqual([]);
  });

});
