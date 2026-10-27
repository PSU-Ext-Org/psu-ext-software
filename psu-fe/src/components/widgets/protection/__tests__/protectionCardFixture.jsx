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
import { afterEach, beforeEach, vi } from "vitest";

import { WIDGET_CONFIG_STORAGE_KEY } from "../../widgetConfigStore.js";

const mockConnection = vi.hoisted(() => ({
  wsConnected: true,
  devices: [{ id: "0", name: "PSU1", type: "TCP" }],
  deviceStatuses: { 0: { state: "CONNECTED" } },
  sendScpiCommand: vi.fn(() => Promise.resolve({ ok: true, response: "0" })),
}));

vi.mock("../../../../connection/ws-proxy/WebSocketConnectionContext.jsx", () => ({
  useWebSocketConnection: () => mockConnection,
}));

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  mockConnection.wsConnected = true;
  mockConnection.devices = [{ id: "0", name: "PSU1", type: "TCP" }];
  mockConnection.deviceStatuses = { 0: { state: "CONNECTED" } };
  mockConnection.sendScpiCommand.mockReset();
  mockConnection.sendScpiCommand.mockResolvedValue({ ok: true, response: "0" });
});

/** Persists a runnable protection definition with per-test overrides. */
export function saveConfig(widgetId, config) {
  window.localStorage.setItem(
    WIDGET_CONFIG_STORAGE_KEY,
    JSON.stringify({
      [widgetId]: {
        type: "protectionControl",
        deviceName: "PSU1",
        cardName: "Protection Control",
        valueColor: "#0f766e",
        unit: "",
        channel: "CH1",
        protectionKey: "OVP",
        frequencyHz: 1,
        valueQuery: "OVP? CH1",
        valueSetTemplate: "OVP CH1,{value}",
        tripQuery: "OVP:PROTect:STATe? CH1",
        enableQuery: "",
        enableOnCommand: "",
        enableOffCommand: "",
        enabledResponse: "1",
        disabledResponse: "0",
        minValue: 0,
        maxValue: 9999.9999,
        decimals: 4,
        ...config,
      },
    }),
  );
}

/** Waits for scheduled trip polls in real-timer integration tests. */
export function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export { mockConnection };
