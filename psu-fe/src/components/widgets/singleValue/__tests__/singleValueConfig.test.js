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
import {
  DEFAULT_SINGLE_VALUE_CONFIG,
  loadSingleValueConfig,
  normalizeSingleValueConfig,
  saveSingleValueConfig,
} from "../singleValueConfig.js";
import { loadStoredWidgetConfigs } from "../../widgetConfigStore.js";

describe("SingleValueCard config", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("stores independent configs by widget id", () => {
    saveSingleValueConfig("single-value-home-voltage", {
      deviceName: "PSU1",
      query: "MEAS:VOLT? CH1",
      frequencyHz: 1,
      unit: "V",
      cardName: "Voltage",
      valueColor: "#2563eb",
    });
    saveSingleValueConfig("single-value-home-current", {
      deviceName: "PSU1",
      query: "MEAS:CURR? CH1",
      frequencyHz: 2,
      unit: "A",
      cardName: "Current",
      valueColor: "#0f766e",
    });

    expect(loadSingleValueConfig("single-value-home-voltage")).toMatchObject({
      cardName: "Voltage",
      query: "MEAS:VOLT? CH1",
    });
    expect(loadSingleValueConfig("single-value-home-current")).toMatchObject({
      cardName: "Current",
      query: "MEAS:CURR? CH1",
    });
  });

  it("normalizes malformed records to safe defaults", () => {
    expect(
      normalizeSingleValueConfig({ type: "singleValue", query: "OUTP ON", frequencyHz: 500 }),
    ).toEqual({
      ...DEFAULT_SINGLE_VALUE_CONFIG,
      cardName: "Single Value",
      frequencyHz: 100,
    });
  });

  it("preserves unrelated stored records", () => {
    saveSingleValueConfig("single-value-home-main", {
      deviceName: "PSU2",
      query: "MEAS:CURR? CH1",
      frequencyHz: 5,
      unit: "A",
      cardName: "Current",
      valueColor: "#0f766e",
    });

    expect(loadStoredWidgetConfigs()["single-value-home-main"]).toMatchObject({
      deviceName: "PSU2",
      cardName: "Current",
    });
  });
});
