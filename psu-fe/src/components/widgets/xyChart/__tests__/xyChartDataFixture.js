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
import { afterEach, beforeEach, vi } from "vitest";
import { useXyChartData } from "../hooks/useXyChartData.js";

import { normalizeXyChartConfig } from "../xyChartConfig.js";

export const X_QUERY = ["PSU1", "MEAS:VOLT? CH1"];
export const Y_QUERY = ["PSU1", "MEAS:CURR? CH1"];

/** Builds a normalized X-Y configuration for the shared test sources. */
export function createConfig(overrides = {}) {
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

export let scheduler;

beforeEach(() => {
  vi.useFakeTimers();
  scheduler = createScheduler();
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

/** Mounts an X-Y data hook against the current test scheduler. */
export function renderData(config = createConfig(), widgetId = "xy-test") {
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

/** Publishes ordered pairs with deterministic timestamps. */
export function publishPairs(count) {
  for (let index = 1; index <= count; index += 1) {
    scheduler.publish(X_QUERY, { value: String(index), updatedAt: index * 10 });
    scheduler.publish(Y_QUERY, { value: String(index * 2), updatedAt: index * 10 + 1 });
  }
}
