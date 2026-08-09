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
  WIDGET_CONFIG_STORAGE_KEY,
  deleteStoredWidgetConfig,
  loadStoredWidgetConfigs,
  saveStoredWidgetConfig,
} from "./widgetConfigStore.js";

describe("widgetConfigStore", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("safely falls back when persisted JSON is malformed", () => {
    window.localStorage.setItem(WIDGET_CONFIG_STORAGE_KEY, "{not json");
    expect(loadStoredWidgetConfigs()).toEqual({});
  });

  it("preserves unrelated stored widget records when writing one record", () => {
    window.localStorage.setItem(
      WIDGET_CONFIG_STORAGE_KEY,
      JSON.stringify({
        unrelated: { type: "other", value: true },
      }),
    );

    saveStoredWidgetConfig("single-value-home-main", { type: "singleValue", cardName: "Voltage" });

    expect(loadStoredWidgetConfigs()).toEqual({
      unrelated: { type: "other", value: true },
      "single-value-home-main": { type: "singleValue", cardName: "Voltage" },
    });
  });

  it("deletes one widget record and dispatches a change event", () => {
    const listener = vi.fn();
    window.addEventListener("psu-ext-widget-configs-change", listener);
    saveStoredWidgetConfig("single-value-home-main", { type: "singleValue", cardName: "Voltage" });
    listener.mockClear();

    deleteStoredWidgetConfig("single-value-home-main");

    expect(loadStoredWidgetConfigs()).toEqual({});
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { widgetId: "single-value-home-main" },
      }),
    );
    window.removeEventListener("psu-ext-widget-configs-change", listener);
  });
});
