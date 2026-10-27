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
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";

const mockUplot = vi.hoisted(() => ({
  instances: [],
  constructor: vi.fn(function UplotMock(options, data, root) {
    this.options = options;
    this.data = data;
    this.root = root;
    this.setData = vi.fn((nextData) => {
      this.data = nextData;
    });
    this.setSize = vi.fn();
    this.destroy = vi.fn();
    mockUplot.instances.push(this);
    for (const ready of options.hooks?.ready || []) {
      ready(this);
    }
  }),
}));

vi.mock("uplot", () => ({
  default: mockUplot.constructor,
}));

const mockConnection = vi.hoisted(() => ({
  wsConnected: true,
  devices: [{ id: "0", name: "PSU1", type: "TCP" }],
  deviceStatuses: { 0: { state: "CONNECTED" } },
  subscribeScpiSnapshot: vi.fn(() => vi.fn()),
  getScpiQuerySnapshot: vi.fn(() => ({
    value: "12.04",
    updatedAt: 1000,
    loading: false,
    error: "",
  })),
}));

vi.mock("../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  mockConnection.wsConnected = true;
  mockConnection.devices = [{ id: "0", name: "PSU1", type: "TCP" }];
  mockConnection.deviceStatuses = { 0: { state: "CONNECTED" } };
  mockConnection.subscribeScpiSnapshot.mockReset();
  mockConnection.subscribeScpiSnapshot.mockReturnValue(vi.fn());
  mockConnection.getScpiQuerySnapshot.mockReset();
  mockConnection.getScpiQuerySnapshot.mockReturnValue({
    value: "12.04",
    updatedAt: 1000,
    loading: false,
    error: "",
  });
  mockUplot.instances = [];
  mockUplot.constructor.mockClear();
});

/** Persists a chart definition for renderer and history integration tests. */
export function saveChartConfig(widgetId, series, historyLimitBytes = 256 * 1024, statistics = {}) {
  const current = JSON.parse(window.localStorage.getItem(WIDGET_CONFIG_STORAGE_KEY) || "{}");
  window.localStorage.setItem(
    WIDGET_CONFIG_STORAGE_KEY,
    JSON.stringify({
      ...current,
      [widgetId]: {
        type: "chart",
        cardName: "Voltage Trend",
        unit: "V",
        frequencyHz: 1,
        historyLimitBytes,
        statistics,
        series,
      },
    }),
  );
}

export { mockUplot, mockConnection };
