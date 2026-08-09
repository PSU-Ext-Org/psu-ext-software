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
import { afterEach, describe, expect, it } from "vitest";
import { saveChartConfig } from "./chart/chartConfig.js";
import { saveSingleToggleConfig } from "./singleToggle/singleToggleConfig.js";
import { saveSingleValueConfig } from "./singleValue/singleValueConfig.js";
import { getAllRunnableWidgetSubscriptions } from "./widgetConfigRegistry.js";

describe("widgetConfigRegistry", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("collects runnable single-value subscriptions", () => {
    saveSingleValueConfig("single-value-home-main", {
      deviceName: "PSU1",
      query: "MEAS:VOLT? CH1",
      frequencyHz: 10,
    });

    expect(getAllRunnableWidgetSubscriptions()).toEqual([
      {
        widgetId: "single-value-home-main",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        frequencyHz: 10,
      },
    ]);
  });

  it("collects runnable chart subscriptions", () => {
    saveChartConfig("chart-home-main", {
      cardName: "Voltage Trend",
      frequencyHz: 5,
      series: [
        {
          id: "voltage",
          label: "Voltage",
          deviceName: "PSU1",
          query: "MEAS:VOLT? CH1",
          lineColor: "#2563eb",
        },
      ],
    });

    expect(getAllRunnableWidgetSubscriptions()).toEqual([
      {
        widgetId: "chart-home-main:voltage",
        seriesId: "voltage",
        deviceName: "PSU1",
        query: "MEAS:VOLT? CH1",
        frequencyHz: 5,
      },
    ]);
  });

  it("ignores non-runnable widget configs", () => {
    saveSingleValueConfig("single-value-home-empty", {
      deviceName: "",
      query: "",
    });
    saveChartConfig("chart-home-empty", {
      series: [
        {
          id: "empty",
          label: "Empty",
          deviceName: "",
          query: "",
          lineColor: "#2563eb",
        },
      ],
    });

    expect(getAllRunnableWidgetSubscriptions()).toEqual([]);
  });

  it("collects runnable single-toggle refresh subscriptions", () => {
    saveSingleToggleConfig("single-toggle-home-main", {
      deviceName: "PSU1",
      statusCommand: "OUTP? CH1",
      onCommand: "OUTP CH1,1",
      offCommand: "OUTP CH1,0",
      autoRefreshEnabled: true,
      refreshFrequencyHz: 2,
    });

    expect(getAllRunnableWidgetSubscriptions()).toEqual([
      {
        widgetId: "single-toggle-home-main",
        deviceName: "PSU1",
        query: "OUTP? CH1",
        frequencyHz: 2,
      },
    ]);
  });
});
