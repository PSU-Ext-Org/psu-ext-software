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
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useXyChartData } from "../hooks/useXyChartData.js";
import {
  deleteXyChartHistory,
  getXyChartHistoryUsageBytes,
  loadXyChartHistory,
} from "../storage/xyChartHistoryStorage.js";
import { normalizeXyChartConfig } from "../xyChartConfig.js";

const X_QUERY = ["PSU1", "MEAS:VOLT? CH1"];
const Y_QUERY = ["PSU1", "MEAS:CURR? CH1"];

function createConfig(overrides = {}) {
  return normalizeXyChartConfig({
    type: "xyChart",
    pairTimeoutMs: 1000,
    x: { deviceName: X_QUERY[0], query: X_QUERY[1] },
    y: { deviceName: Y_QUERY[0], query: Y_QUERY[1] },
    ...overrides,
  });
}

function createScheduler() {
  const snapshots = new Map();
  const listeners = new Map();
  const key = (deviceName, query) => `${deviceName}|${query}`;

  return {
    getScpiQuerySnapshot: (deviceName, query) =>
      snapshots.get(key(deviceName, query)) || { value: "", updatedAt: 0, loading: false, error: "" },
    subscribeScpiSnapshot: vi.fn((deviceName, query, listener) => {
      const set = listeners.get(key(deviceName, query)) || new Set();
      set.add(listener);
      listeners.set(key(deviceName, query), set);
      return () => set.delete(listener);
    }),
    publish(target, snapshot) {
      snapshots.set(key(...target), { loading: false, error: "", ...snapshot });
      act(() => {
        for (const listener of [...(listeners.get(key(...target)) || [])]) {
          listener();
        }
      });
    },
    listenerCount: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
  };
}

describe("useXyChartData", () => {
  let scheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = createScheduler();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  function renderData(config = createConfig(), widgetId = "xy-test") {
    return renderHook(
      ({ current }) =>
        useXyChartData({
          widgetId,
          config: current,
          getScpiQuerySnapshot: scheduler.getScpiQuerySnapshot,
          subscribeScpiSnapshot: scheduler.subscribeScpiSnapshot,
        }),
      { initialProps: { current: config } },
    );
  }

  function publishPairs(count) {
    for (let index = 1; index <= count; index += 1) {
      scheduler.publish(X_QUERY, { value: String(index), updatedAt: index * 10 });
      scheduler.publish(Y_QUERY, { value: String(index * 2), updatedAt: index * 10 + 1 });
    }
  }

  it("pairs a fresh X and Y update into one point", () => {
    const { result } = renderData();

    scheduler.publish(X_QUERY, { value: "1.5", updatedAt: 100 });
    scheduler.publish(Y_QUERY, { value: "0.25", updatedAt: 200 });

    expect(result.current.points).toEqual([{ x: 1.5, y: 0.25, t: 200 }]);
  });

  it("ignores loading-only notifications that do not advance updatedAt", () => {
    const { result } = renderData();

    scheduler.publish(X_QUERY, { value: "1.5", updatedAt: 100 });
    scheduler.publish(X_QUERY, { value: "1.5", updatedAt: 100, loading: true });
    scheduler.publish(Y_QUERY, { value: "0.25", updatedAt: 200 });

    expect(result.current.points).toHaveLength(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.points).toHaveLength(1);
  });

  it("ignores error and non-numeric snapshots", () => {
    const { result } = renderData();

    scheduler.publish(X_QUERY, { value: "1.5", updatedAt: 100, error: "ERR timeout" });
    scheduler.publish(Y_QUERY, { value: "not a number", updatedAt: 200 });
    act(() => vi.advanceTimersByTime(5000));

    expect(result.current.points).toEqual([]);
  });

  it("does not emit points from cached snapshots on mount", () => {
    scheduler.publish(X_QUERY, { value: "1", updatedAt: 100 });
    scheduler.publish(Y_QUERY, { value: "2", updatedAt: 100 });

    const { result } = renderData();
    act(() => vi.advanceTimersByTime(5000));

    expect(result.current.points).toEqual([]);
  });

  it("carries the cached value of the silent axis after the pair timeout", () => {
    scheduler.publish(Y_QUERY, { value: "0.25", updatedAt: 50 });
    const { result } = renderData();

    scheduler.publish(X_QUERY, { value: "1.5", updatedAt: 100 });
    expect(result.current.points).toEqual([]);

    act(() => vi.advanceTimersByTime(1000));

    expect(result.current.points).toEqual([{ x: 1.5, y: 0.25, t: 100 }]);
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

  it("does not subscribe until both axes are configured, and unsubscribes on unmount", () => {
    const unconfigured = renderData(normalizeXyChartConfig({ type: "xyChart" }));
    expect(scheduler.listenerCount()).toBe(0);
    unconfigured.unmount();

    const { unmount } = renderData();
    expect(scheduler.listenerCount()).toBe(2);

    unmount();
    expect(scheduler.listenerCount()).toBe(0);
  });

  it("pairs immediately when X and Y use the same query", () => {
    const { result } = renderData(createConfig({ y: { deviceName: X_QUERY[0], query: X_QUERY[1] } }));

    scheduler.publish(X_QUERY, { value: "5", updatedAt: 100 });

    expect(result.current.points).toEqual([{ x: 5, y: 5, t: 100 }]);
  });
});
