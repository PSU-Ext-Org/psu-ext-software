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
import { X_QUERY, Y_QUERY, createConfig, scheduler, renderData } from "./xyChartDataFixture.js";
import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useXyChartData } from "../hooks/useXyChartData.js";

import { normalizeXyChartConfig } from "../xyChartConfig.js";

describe("useXyChartData", () => {
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
